"""
fake_esp32.py - pretends to be the Wokwi ESP32 station, from your terminal.

Use it to test the backend + dashboard without opening Wokwi, or as a
backup during a demo. It speaks exactly the same MQTT messages as
esp32-wokwi/sketch.ino.

    python tools/fake_esp32.py              # interactive: type commands
    python tools/fake_esp32.py --demo       # runs the full demo story by itself

Interactive commands:
    tap 01:02:03:04     tap a card (blue=01:02:03:04 green=11:22:33:44 yellow=55:66:77:88 red=AA:BB:CC:DD)
    1 / 2 / 5           choose litres
    pay                 PAY button (wallet)
    anomaly             ANOMALY button
    leak                flow while the valve is closed
    ack                 acknowledge an alarm (PAY in alert state)
    quit
"""

import argparse
import json
import threading
import time
import uuid

import paho.mqtt.client as mqtt

FLOW_LPM = 20.0  # same as the 150 Hz clock in diagram.json (150 / 450 * 60)


class FakeStation:
    def __init__(self, broker, port, root, station_id, transport="tcp"):
        self.topic_up = f"{root}/{station_id}/up"
        self.topic_down = f"{root}/{station_id}/down"
        self.topic_status = f"{root}/{station_id}/status"

        self.state = "IDLE"
        self.user_id = None
        self.order_id = None
        self.target = 0.0
        self.liters = 0.0
        self.stop_reason = None
        self.lock = threading.Lock()
        self.replies = []  # every message received, for --demo checks

        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"fake-esp32-{uuid.uuid4().hex[:6]}", transport=transport)
        if transport == "websockets":
            self.client.ws_set_options(path="/mqtt")
        if port in (443, 8081, 8084, 8883, 8884):   # secure ports
            self.client.tls_set()
        self.client.will_set(self.topic_status, "offline", retain=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.connect(broker, port, keepalive=15)
        self.client.loop_start()
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()

    # ---------- sending ----------

    def send(self, msg_type, **data):
        payload = {"type": msg_type, "state": self.state, "valve": "Open" if self.state == "DISPENSING" else "Closed",
                   "rssi": -55, **data}
        self.client.publish(self.topic_up, json.dumps(payload))
        print(f"  → {msg_type} {data if data else ''}")

    def on_connect(self, client, userdata, flags, reason_code, properties):
        client.subscribe(self.topic_down)
        client.publish(self.topic_status, "online", retain=True)
        self.send("hello", fw="fake-3.0", ip="127.0.0.1")
        print(f"✓ Fake ESP32 connected. Publishing on {self.topic_up}")

    def heartbeat_loop(self):
        while True:
            time.sleep(5)
            self.send_quiet("heartbeat")

    def send_quiet(self, msg_type, **data):
        payload = {"type": msg_type, "state": self.state, "valve": "Open" if self.state == "DISPENSING" else "Closed",
                   "rssi": -55, **data}
        self.client.publish(self.topic_up, json.dumps(payload))

    # ---------- receiving ----------

    def on_message(self, client, userdata, message):
        try:
            data = json.loads(message.payload)
        except ValueError:
            print(f"  (ignored non-JSON message on {message.topic}: {message.payload!r})")
            return
        self.replies.append(data)
        kind = data["type"]
        print(f"  ← {kind} {({k: v for k, v in data.items() if k != 'type'})}")

        if kind == "card_result":
            if data["ok"]:
                self.state, self.user_id = "CARD_OK", data["user_id"]
            else:
                self.state = "IDLE"
        elif kind == "order_ready":
            self.state, self.user_id, self.order_id, self.target = "AWAITING_PAYMENT", data["user_id"], data["order_id"], data["liters"]
        elif kind == "order_failed" or kind == "payment_failed":
            pass
        elif kind == "payment_ok":
            threading.Thread(target=self.dispense, daemon=True).start()
        elif kind == "finish_ok":
            self.state = "COMPLETE"
        elif kind == "stop":
            self.stop_reason = data.get("reason", "Stopped")
            if self.state != "DISPENSING":
                self.state = "ALERT"
        elif kind == "reset":
            self.reset()
        elif kind == "tap_card":
            self.tap(data["uid"])

    # ---------- station actions ----------

    def tap(self, uid):
        self.reset()
        self.send("card", uid=uid)

    def order(self, liters):
        self.send("order", user_id=self.user_id, liters=float(liters))

    def pay(self):
        if self.state == "ALERT":
            self.send("ack")
            self.reset()
        else:
            self.send("pay_wallet", order_id=self.order_id)

    def dispense(self):
        self.state, self.liters, self.stop_reason = "DISPENSING", 0.0, None
        while self.liters < self.target and not self.stop_reason:
            time.sleep(1)
            self.liters = min(self.target, self.liters + FLOW_LPM / 60)
            self.send_quiet("progress", order_id=self.order_id, liters=round(self.liters, 2), flow=FLOW_LPM)
        if self.stop_reason:
            self.state = "ALERT"
            self.send("complete", order_id=self.order_id, liters=round(self.liters, 2), result="stopped", reason=self.stop_reason)
        else:
            self.state = "COMPLETE"
            self.send("complete", order_id=self.order_id, liters=round(self.liters, 2), result="done")
            threading.Timer(7, self.back_home_after_done).start()   # like the 7 s "thank you" screen

    def back_home_after_done(self):
        if self.state == "COMPLETE":
            self.reset()
            self.send_quiet("heartbeat")

    def anomaly(self, reason="Abnormal flow (manual test)"):
        if self.state == "DISPENSING":
            self.stop_reason = reason
        else:
            self.state = "ALERT"
            self.send("anomaly", reason=reason)

    def reset(self):
        self.state, self.user_id, self.order_id, self.target, self.liters = "IDLE", None, None, 0.0, 0.0


def wait_for(station, kind, timeout=15):
    """Wait until a message of `kind` arrives from the backend (used by --demo)."""
    start = time.time()
    seen = len(station.replies)
    while time.time() - start < timeout:
        for reply in station.replies[seen:]:
            if reply["type"] == kind:
                return reply
        time.sleep(0.1)
    raise TimeoutError(f"No '{kind}' reply within {timeout}s")


def run_demo(station):
    print("\n=== 1. Rohith (blue card) buys 1 L with the wallet ===")
    station.tap("01:02:03:04"); wait_for(station, "card_result")
    station.order(1); wait_for(station, "order_ready")
    station.pay(); wait_for(station, "payment_ok"); wait_for(station, "finish_ok")
    time.sleep(2); station.reset()

    print("\n=== 2. Deepankishor (green card) has a low wallet → wallet refused ===")
    station.tap("11:22:33:44"); wait_for(station, "card_result")
    station.order(2); wait_for(station, "order_ready")
    station.pay(); wait_for(station, "payment_failed")
    print("   (on the dashboard → Live Station: 'Top up with Razorpay & pay')")
    time.sleep(2); station.send("cancel", order_id=station.order_id); station.reset()

    print("\n=== 3. Sanjay (yellow card) takes 5 L → over-usage alert on the admin dashboard ===")
    station.tap("55:66:77:88"); wait_for(station, "card_result")
    station.order(5); ready = wait_for(station, "order_ready")
    print("   warning shown on OLED:", ready.get("warning") or "(none)")
    station.pay(); wait_for(station, "payment_ok"); reply = wait_for(station, "finish_ok", timeout=30)
    print(f"   charged ₹{reply.get('charged')}, wallet now ₹{reply.get('balance')}")
    time.sleep(1); station.reset()

    print("\n=== 4. Rohith 5 L, admin presses Emergency stop → unused litres refunded ===")
    station.tap("01:02:03:04"); wait_for(station, "card_result")
    station.order(5); wait_for(station, "order_ready")
    station.pay(); wait_for(station, "payment_ok")
    time.sleep(3.5); station.stop_reason = "Stopped by admin (fake)"
    reply = wait_for(station, "finish_ok", timeout=10)
    print(f"   charged ₹{reply.get('charged')}, refunded ₹{reply.get('refund')}")
    time.sleep(1); station.reset()

    print("\n=== 5. Unknown red card ===")
    station.tap("AA:BB:CC:DD"); wait_for(station, "card_result")
    station.reset()
    print("\n✓ Demo finished. Check the dashboard: transactions, alerts and the Live Station event log.")


def main():
    parser = argparse.ArgumentParser(description="Fake AquaAllot ESP32 station")
    parser.add_argument("--broker", default="test.mosquitto.org")
    parser.add_argument("--port", type=int, default=8081, help="8081 = secure WebSockets (works where 1883 is blocked)")
    parser.add_argument("--transport", default="websockets", choices=["tcp", "websockets"])
    parser.add_argument("--root", default="aquaallot-demo-rohith1205", help="must match MQTT_TOPIC_ROOT")
    parser.add_argument("--station", default="STN-001")
    parser.add_argument("--demo", action="store_true", help="run the demo story automatically")
    args = parser.parse_args()

    station = FakeStation(args.broker, args.port, args.root, args.station, args.transport)
    time.sleep(1.5)

    if args.demo:
        run_demo(station)
        time.sleep(1)
        return

    print(__doc__.split("Interactive commands:")[1])
    while True:
        try:
            line = input(f"[{station.state}] > ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not line:
            continue
        cmd, *rest = line.split()
        if cmd == "quit":
            break
        elif cmd == "tap" and rest:
            station.tap(rest[0])
        elif cmd in ("1", "2", "5"):
            station.order(cmd)
        elif cmd == "pay":
            station.pay()
        elif cmd == "anomaly":
            station.anomaly()
        elif cmd == "leak":
            station.anomaly("Leak: flow while valve closed")
        elif cmd == "ack":
            station.send("ack"); station.reset()
        else:
            print("unknown command")
        time.sleep(0.5)

    station.client.publish(station.topic_status, "offline", retain=True)


if __name__ == "__main__":
    main()
