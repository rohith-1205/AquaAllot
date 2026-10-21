"""
check_network.py - finds out which MQTT broker + port YOUR laptop can reach.

    cd backend
    npm run check          (or: python tools/check_network.py)

It tests DNS, plain TCP and a real MQTT connection for several free public
brokers, then prints the exact settings to put in backend/.env and sketch.ino.
"""

import socket
import threading
import time
import urllib.request
import uuid

# (broker, port, transport, use_tls, label)
CANDIDATES = [
    ("broker.hivemq.com", 1883, "tcp", False, "HiveMQ  · MQTT"),
    ("broker.hivemq.com", 8000, "websockets", False, "HiveMQ  · WebSockets"),
    ("broker.hivemq.com", 8884, "websockets", True, "HiveMQ  · secure WebSockets"),
    ("broker.emqx.io", 1883, "tcp", False, "EMQX    · MQTT"),
    ("broker.emqx.io", 8084, "websockets", True, "EMQX    · secure WebSockets"),
    ("test.mosquitto.org", 1883, "tcp", False, "Mosquitto · MQTT"),
    ("test.mosquitto.org", 8081, "websockets", True, "Mosquitto · secure WebSockets"),
    ("mqtt.eclipseprojects.io", 1883, "tcp", False, "Eclipse · MQTT"),
    ("mqtt.eclipseprojects.io", 443, "websockets", True, "Eclipse · secure WebSockets on 443"),
]


def check_dns(host):
    try:
        return True, socket.getaddrinfo(host, None)[0][4][0]
    except OSError as error:
        return False, f"DNS failed ({error})"


def check_tcp(host, port):
    try:
        with socket.create_connection((host, port), timeout=5):
            return True, "open"
    except socket.timeout:
        return False, "timed out (blocked by firewall / network?)"
    except OSError as error:
        return False, str(error)


def check_mqtt(host, port, transport, use_tls):
    """Real MQTT connect + publish + receive our own message."""
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        return False, "paho-mqtt not installed (run npm run dev once first)"

    topic = f"aquaallot-check/{uuid.uuid4().hex[:8]}"
    got_message = threading.Event()
    result = {"error": "no answer from broker"}

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            result["error"] = f"broker refused: {reason_code}"
            return
        client.subscribe(topic)
        client.publish(topic, "ping")

    def on_message(client, userdata, message):
        got_message.set()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"aquaallot-check-{uuid.uuid4().hex[:6]}", transport=transport)
    if transport == "websockets":
        client.ws_set_options(path="/mqtt")
    if use_tls:
        client.tls_set()
    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(host, port, keepalive=15)
    except Exception as error:  # noqa: BLE001 - we want to show any reason
        return False, f"connect failed ({error})"
    client.loop_start()
    ok = got_message.wait(8)
    client.loop_stop()
    try:
        client.disconnect()
    except Exception:
        pass
    return (True, "works!") if ok else (False, result["error"])


def main():
    print("\n=== AquaAllot network check ===\n")

    proxies = urllib.request.getproxies()
    if proxies:
        print(f"⚠  A proxy is configured on this computer: {proxies}")
        print("   Programs like the backend may need to go through it. College/office networks often do this.\n")
    else:
        print("✓  No system proxy configured\n")

    ok, detail = check_tcp("www.google.com", 443)
    print(f"{'✓' if ok else '✗'}  Normal internet (google.com:443): {detail}\n")

    working = []
    for host, port, transport, use_tls, label in CANDIDATES:
        dns_ok, dns_detail = check_dns(host)
        if not dns_ok:
            print(f"✗  {label:38} {host}:{port}  →  {dns_detail}")
            continue
        tcp_ok, tcp_detail = check_tcp(host, port)
        if not tcp_ok:
            print(f"✗  {label:38} {host}:{port}  →  TCP {tcp_detail}")
            continue
        mqtt_ok, mqtt_detail = check_mqtt(host, port, transport, use_tls)
        print(f"{'✓' if mqtt_ok else '✗'}  {label:38} {host}:{port}  →  MQTT {mqtt_detail}")
        if mqtt_ok:
            working.append((host, port, transport, use_tls))

    print()
    if not working:
        print("✗  No broker reachable from this computer.")
        print("   • Try another network (e.g. your phone's hotspot) to confirm it's the network.")
        print("   • Allow Python in your antivirus / Windows Firewall.")
        print("   • Send this output to your helper.\n")
        return

    host, port, transport, use_tls = working[0]
    print("✓  Use these settings:\n")
    print("   backend/.env  (add or change these lines, then restart npm run dev)")
    print(f"     MQTT_BROKER={host}")
    print(f"     MQTT_PORT={port}")
    print(f"     MQTT_TRANSPORT={transport}")
    print()
    print("   esp32-wokwi/sketch.ino  (Wokwi always uses plain MQTT on port 1883)")
    print(f'     const char* MQTT_BROKER   = "{host}";')
    print("     const int   MQTT_PORT     = 1883;\n")


if __name__ == "__main__":
    start = time.time()
    main()
    print(f"(took {time.time() - start:.0f} s)")
