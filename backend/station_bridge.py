"""
station_bridge.py - the link between the backend and the Wokwi ESP32.

Why MQTT?  The Wokwi simulator runs on wokwi.com, so it can't reach
"localhost" on your laptop. Instead, both sides connect *out* to the same
free public MQTT broker and exchange small JSON messages through it:

    Wokwi ESP32  --->  broker.hivemq.com  <---  this backend (your laptop)

Topics  (ROOT = MQTT_TOPIC_ROOT, must be the same in sketch.ino):

    ROOT/<station>/up       ESP32  -> backend   (events from the station)
    ROOT/<station>/down     backend -> ESP32    (replies and commands)
    ROOT/<station>/status   "online" / "offline" (retained, set by the ESP32)

Every message is JSON with a "type" field:

    ESP32 -> backend (up)                 backend -> ESP32 (down)
    -------------------------------       -----------------------------------------
    hello      ESP32 connected            card_result     card ok? + user + wallet
    heartbeat  every 5 s                  order_ready     order id + amount to pay
    card       RFID card tapped           order_failed    reason
    order      1/2/5 L button pressed     payment_ok      open the valve!
    pay_wallet PAY button pressed         payment_failed  reason (e.g. low balance)
    progress   litres so far (every 1 s)  finish_ok       saved + anomaly result
    complete   valve closed, final litres stop            emergency stop from dashboard
    anomaly    leak / manual anomaly      reset           go back to the home screen
    ack        alarm acknowledged         tap_card        "virtual" card tap from dashboard
    cancel     order abandoned
"""

import json
import logging
import threading
import time
import uuid
from collections import deque
from datetime import datetime

import services
from services import ServiceError

log = logging.getLogger("aquaallot.bridge")

OFFLINE_AFTER_SECONDS = 15   # no message for this long -> station shown as offline
MAX_EVENTS = 80              # size of the live event log shown on the dashboard


class StationBridge:
    def __init__(self, store, broker, port, topic_root, transport="tcp", ws_path="/mqtt",
                 enabled=True, stations=()):
        self.store = store
        self.broker, self.port = broker, int(port)
        self.topic_root = topic_root.strip("/")
        self.transport, self.ws_path = transport, ws_path
        self.enabled = enabled

        self.lock = threading.RLock()
        self.client = None
        self.connected = False
        self.last_error = None
        self.events = deque(maxlen=MAX_EVENTS)
        self.live = {station_id: _blank_live(station_id) for station_id in stations}

        self.handlers = {
            "hello": self._on_hello,
            "heartbeat": self._on_heartbeat,
            "card": self._on_card,
            "order": self._on_order,
            "pay_wallet": self._on_pay_wallet,
            "cancel": self._on_cancel,
            "progress": self._on_progress,
            "complete": self._on_complete,
            "anomaly": self._on_anomaly,
            "ack": self._on_ack,
        }

    # =================================================================
    #   MQTT connection
    # =================================================================

    def start(self):
        if not self.enabled:
            log.info("MQTT bridge disabled (MQTT_ENABLED=false)")
            return
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            self.last_error = "paho-mqtt is not installed (pip install -r requirements.txt)"
            log.error(self.last_error)
            return

        client_id = f"aquaallot-backend-{uuid.uuid4().hex[:6]}"
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, transport=self.transport)
        if self.transport == "websockets":
            self.client.ws_set_options(path=self.ws_path)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)

        log.info("📡 Connecting to MQTT broker %s:%s (%s) ...", self.broker, self.port, self.transport)
        self.client.connect_async(self.broker, self.port, keepalive=30)
        self.client.loop_start()

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            self.last_error = f"Broker refused connection: {reason_code}"
            log.error(self.last_error)
            return
        self.connected, self.last_error = True, None
        client.subscribe(f"{self.topic_root}/+/up")
        client.subscribe(f"{self.topic_root}/+/status")
        log.info("✓ MQTT connected. Listening on %s/+/up", self.topic_root)
        self._log(None, "system", "mqtt", f"Backend connected to MQTT broker {self.broker}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        self.connected = False
        self.last_error = f"Disconnected from broker ({reason_code}), retrying..."
        log.warning(self.last_error)

    def _on_message(self, client, userdata, message):
        # Topic looks like ROOT/<station>/up   (ROOT itself may contain '/')
        parts = message.topic.split("/")
        station_id, channel = parts[-2], parts[-1]
        text = message.payload.decode("utf-8", errors="replace")

        try:
            if channel == "status":
                self._on_status(station_id, text)
                return
            data = json.loads(text)
            handler = self.handlers.get(data.get("type"))
            if handler is None:
                log.warning("Unknown message from %s: %s", station_id, text)
                return
            with self.lock:
                self._touch(station_id, data)
                handler(station_id, data)
        except Exception:
            log.exception("Error handling MQTT message on %s: %s", message.topic, text)

    def send(self, station_id, msg_type, **data):
        """Publish a message to the ESP32 of `station_id`."""
        payload = {"type": msg_type, **data}
        if self.client is not None and self.connected:
            self.client.publish(f"{self.topic_root}/{station_id}/down", json.dumps(payload))
        else:
            log.warning("MQTT not connected, could not send %s to %s", msg_type, station_id)

    # =================================================================
    #   Messages from the ESP32
    # =================================================================

    def _on_status(self, station_id, text):
        with self.lock:
            live = self._live(station_id)
            if text.strip().lower() == "online":
                live["lastSeen"] = time.time()
            else:
                live["lastSeen"] = None
                self._log(station_id, "up", "status", "ESP32 went offline")

    def _on_hello(self, station_id, data):
        live = self._live(station_id)
        live.update(user=None, order=None, alert=None, dispensed=0.0, target=0.0, flowLpm=0.0)
        self._log(station_id, "up", "hello", f"ESP32 connected (firmware {data.get('fw', '?')}, IP {data.get('ip', '?')})")

    def _on_heartbeat(self, station_id, data):
        pass  # _touch() already stored state, valve, rssi

    def _on_card(self, station_id, data):
        live = self._live(station_id)
        uid = services.pretty_card(data.get("uid"))
        live["lastCard"] = uid
        self._log(station_id, "up", "card", f"Card tapped: {uid}")
        try:
            user = services.check_card(self.store, uid)
        except ServiceError as error:
            live["user"] = None
            self.send(station_id, "card_result", ok=False, uid=uid, reason=str(error))
            self._log(station_id, "down", "card_result", f"Access denied: {error}")
            return

        live["user"] = services.public_user(user)
        live["order"] = None
        self.send(station_id, "card_result", ok=True, uid=uid, user_id=user["id"], name=user["name"],
                  balance=round(float(user["balance"]), 2), price=services.water_price(self.store))
        self._log(station_id, "down", "card_result", f"Welcome {user['name']} (wallet ₹{user['balance']:.0f})")

    def _on_order(self, station_id, data):
        self._log(station_id, "up", "order", f"{data.get('liters')} L selected")
        try:
            user = self.store.find_one("users", id=data.get("user_id"))
            if not user:
                raise ServiceError("User not found")
            order = services.create_order(self.store, user, data.get("liters", 0), station_id, source="esp32")
        except ServiceError as error:
            self.send(station_id, "order_failed", reason=str(error))
            self._log(station_id, "down", "order_failed", str(error))
            return
        self._announce_order(station_id, order, user, remote=False)

    def _on_pay_wallet(self, station_id, data):
        order_id = data.get("order_id")
        self._log(station_id, "up", "pay_wallet", f"PAY button: wallet payment for {order_id}")
        try:
            order, user = services.pay_order(self.store, order_id, method="Wallet")
        except ServiceError as error:
            self.send(station_id, "payment_failed", order_id=order_id, reason=str(error))
            self._log(station_id, "down", "payment_failed", f"Wallet payment failed: {error}")
            return
        self.payment_confirmed(order, user)

    def _on_cancel(self, station_id, data):
        services.cancel_order(self.store, data.get("order_id"))
        live = self._live(station_id)
        live.update(order=None, user=None, dispensed=0.0, target=0.0)
        self._log(station_id, "up", "cancel", "Order cancelled at the station")

    def _on_progress(self, station_id, data):
        live = self._live(station_id)
        live["dispensed"] = round(float(data.get("liters", 0)), 2)
        live["flowLpm"] = round(float(data.get("flow", 0)), 1)

    def _on_complete(self, station_id, data):
        order_id = data.get("order_id")
        liters = float(data.get("liters", 0))
        result = data.get("result", "done")
        reason = data.get("reason", "")
        self._log(station_id, "up", "complete", f"Valve closed: {liters:.2f} L dispensed ({result})")

        live = self._live(station_id)
        live.update(dispensed=round(liters, 2), flowLpm=0.0)
        if result != "done":
            live["alert"] = reason or result

        if not order_id:  # offline order from the ESP32 - nothing to save
            return
        try:
            outcome = services.finish_order(self.store, order_id, liters, result, reason)
        except ServiceError as error:
            self._log(station_id, "system", "error", f"Could not save order {order_id}: {error}")
            return

        live["order"] = _order_view(outcome["order"])
        live["user"] = services.public_user(outcome["user"])
        anomaly = outcome["anomaly"]
        self.send(station_id, "finish_ok", order_id=order_id, txn_id=outcome["order"].get("txnId"),
                  liters=round(liters, 2), balance=round(float(outcome["user"]["balance"]), 2),
                  anomaly=bool(anomaly), reason="Usage spike!" if anomaly else "")
        if anomaly:
            live["alert"] = f"AI anomaly: {anomaly['reason']}"
            self._log(station_id, "down", "finish_ok", f"Saved. 🚨 {anomaly['reason']}")
        else:
            self._log(station_id, "down", "finish_ok", f"Saved as {outcome['order'].get('txnId')}")

    def _on_anomaly(self, station_id, data):
        reason = data.get("reason", "Anomaly")
        live = self._live(station_id)
        live["alert"] = reason
        self._log(station_id, "up", "anomaly", f"🚨 {reason}")
        user_id = live["user"]["id"] if live.get("user") else None
        services.raise_alert(self.store, "Critical", "Station Anomaly", reason, station_id, user_id)

    def _on_ack(self, station_id, data):
        self._live(station_id).update(alert=None, user=None, order=None, dispensed=0.0, target=0.0)
        self._log(station_id, "up", "ack", "Alarm acknowledged at the station")

    # =================================================================
    #   Actions from the dashboard
    # =================================================================

    def payment_confirmed(self, order, user):
        """Tell the ESP32 to open the valve (called for Wallet and Razorpay payments)."""
        station_id = order["stationId"]
        with self.lock:
            live = self._live(station_id)
            live["order"] = _order_view(order)
            live["user"] = services.public_user(user)
        self.send(station_id, "payment_ok", order_id=order["id"], method=order["paymentMethod"],
                  balance=round(float(user["balance"]), 2))
        self._log(station_id, "down", "payment_ok", f"Paid by {order['paymentMethod']} → open valve")

    def command(self, station_id, action, **params):
        """Dashboard buttons: tap_card, start_order, stop, reset."""
        with self.lock:
            live = self.snapshot_station(station_id)
            if not live["online"]:
                raise ServiceError("Station is offline. Start the Wokwi simulation first.")

            if action == "tap_card":
                uid = services.pretty_card(params.get("uid"))
                if not uid:
                    raise ServiceError("Choose a card to tap")
                if live["state"] not in ("IDLE",):
                    raise ServiceError("Station is busy. Finish or reset it first.")
                self.send(station_id, "tap_card", uid=uid)
                self._log(station_id, "down", "tap_card", f"Virtual card tap from dashboard: {uid}")

            elif action == "start_order":
                if live["state"] not in ("IDLE", "CARD_OK"):
                    raise ServiceError("Station is busy. Finish or reset it first.")
                user = self.store.find_one("users", id=params.get("user_id"))
                if not user:
                    raise ServiceError("User not found")
                services.check_card(self.store, user.get("rfid"))  # same rules as a real tap
                order = services.create_order(self.store, user, params.get("liters", 0), station_id, source="dashboard")
                self._live(station_id)["user"] = services.public_user(user)
                self._announce_order(station_id, order, user, remote=True)
                return order

            elif action == "stop":
                self.send(station_id, "stop", reason="Stopped by admin")
                self._log(station_id, "down", "stop", "🛑 Emergency stop sent from dashboard")

            elif action == "reset":
                self.send(station_id, "reset")
                self._live(station_id).update(state="IDLE", alert=None, user=None, order=None, dispensed=0.0, target=0.0)
                self._log(station_id, "down", "reset", "Station reset from dashboard")

            else:
                raise ServiceError(f"Unknown action '{action}'")
        return None

    # =================================================================
    #   Live state for the dashboard
    # =================================================================

    def snapshot(self):
        with self.lock:
            return {
                "mqtt": {
                    "enabled": self.enabled, "connected": self.connected, "broker": self.broker,
                    "port": self.port, "transport": self.transport, "topicRoot": self.topic_root,
                    "error": self.last_error,
                },
                "stations": [self.snapshot_station(sid) for sid in self.live],
                "events": list(self.events),
            }

    def snapshot_station(self, station_id):
        with self.lock:
            live = dict(self._live(station_id))
        seconds_ago = time.time() - live["lastSeen"] if live["lastSeen"] else None
        live["online"] = seconds_ago is not None and seconds_ago < OFFLINE_AFTER_SECONDS
        live["secondsSinceSeen"] = round(seconds_ago, 1) if seconds_ago is not None else None
        if not live["online"]:
            live["state"] = "OFFLINE"
            live["valve"] = "Closed"
            live["flowLpm"] = 0.0
        return live

    def station_overrides(self, station_id):
        """Fields that replace the static station record with live data (used by GET /api/stations)."""
        if station_id not in self.live:
            return {}
        live = self.snapshot_station(station_id)
        return {
            "status": ("Warning" if live["alert"] else "Online") if live["online"] else "Offline",
            "esp32": "Connected" if live["online"] else "Offline",
            "solenoidValve": live["valve"],
            "flowRate": live["flowLpm"],
            "lastSync": int(live["secondsSinceSeen"]) if live["secondsSinceSeen"] is not None else None,
            "wifiSignal": live["rssi"],
            "firmware": live["firmware"] or "-",
            "liveState": live["state"],
            "alertMessage": live["alert"],
        }

    # =================================================================
    #   Helpers
    # =================================================================

    def _announce_order(self, station_id, order, user, remote):
        live = self._live(station_id)
        live["order"] = _order_view(order)
        live["target"] = order["liters"]
        live["dispensed"] = 0.0
        balance = round(float(user["balance"]), 2)
        self.send(station_id, "order_ready", order_id=order["id"], user_id=user["id"], name=user["name"],
                  balance=balance, liters=order["liters"], amount=order["amount"],
                  wallet_ok=balance >= order["amount"], remote=remote)
        where = "dashboard" if remote else "station"
        self._log(station_id, "down", "order_ready",
                  f"Order {order['id']} ({where}): {order['liters']:g} L = ₹{order['amount']:.0f}, waiting for payment")

    def _live(self, station_id):
        if station_id not in self.live:
            self.live[station_id] = _blank_live(station_id)
        return self.live[station_id]

    def _touch(self, station_id, data):
        """Every message proves the ESP32 is alive and carries its current state."""
        live = self._live(station_id)
        live["lastSeen"] = time.time()
        for field, key in (("state", "state"), ("valve", "valve"), ("rssi", "rssi"), ("fw", "firmware"), ("ip", "ip")):
            if field in data:
                live[key] = data[field]
        if "offline_mode" in data:
            live["offlineMode"] = bool(data["offline_mode"])

    def _log(self, station_id, direction, msg_type, text):
        self.events.appendleft({
            "time": datetime.now().strftime("%H:%M:%S"), "ts": time.time(),
            "stationId": station_id, "direction": direction, "type": msg_type, "text": text,
        })


def _blank_live(station_id):
    return {
        "stationId": station_id, "lastSeen": None, "state": "OFFLINE",
        "user": None, "order": None, "alert": None, "lastCard": None,
        "dispensed": 0.0, "target": 0.0, "flowLpm": 0.0, "valve": "Closed",
        "rssi": None, "firmware": None, "ip": None, "offlineMode": False,
    }


def _order_view(order):
    if not order:
        return None
    keys = ("id", "liters", "amount", "status", "paymentMethod", "txnId", "source", "dispensedLiters", "userId", "userName")
    return {key: order.get(key) for key in keys}
