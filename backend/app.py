"""
╔════════════════════════════════════════════════════════════════════════════╗
║                      AquaAllot Backend (Flask API)                         ║
║                                                                            ║
║   Dashboard (React)  ── HTTP ──►  this API  ◄── MQTT ──  Wokwi ESP32        ║
║                                                                            ║
║   Run it:   cd backend  →  npm run dev     (or: python app.py)             ║
╚════════════════════════════════════════════════════════════════════════════╝

Files in this folder:
    app.py             HTTP routes for the dashboard (this file)
    services.py        business rules: card check, orders, payments, anomaly check
    station_bridge.py  MQTT link to the Wokwi ESP32 + live station state
    payments.py        Razorpay helpers (create order, verify signature)
    store.py           data layer: MongoDB if running, otherwise in-memory
    demo_data.py       the demo users / cards / stations
"""

import logging
import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

import demo_data
import payments
import services
from services import ServiceError
from station_bridge import StationBridge
from store import Store

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ==================== SETTINGS (override them in backend/.env) ====================

PORT = int(os.getenv("PORT", "5000"))
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

MQTT_ENABLED = os.getenv("MQTT_ENABLED", "true").lower() != "false"
MQTT_BROKER = os.getenv("MQTT_BROKER", "test.mosquitto.org")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8081"))           # secure WebSockets: works on networks that block 1883
MQTT_TRANSPORT = os.getenv("MQTT_TRANSPORT", "websockets")  # "tcp" (port 1883) or "websockets"
MQTT_TOPIC_ROOT = os.getenv("MQTT_TOPIC_ROOT", "aquaallot-demo-rohith1205")  # must match sketch.ino

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
logging.getLogger("werkzeug").setLevel(logging.WARNING)  # hide the 1-per-second polling requests
log = logging.getLogger("aquaallot")

# ==================== APP, DATABASE, MQTT BRIDGE ====================

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
CORS(app, resources={r"/api/*": {"origins": "*"}})

store = Store(MONGO_URI)
bridge = StationBridge(
    store, MQTT_BROKER, MQTT_PORT, MQTT_TOPIC_ROOT,
    transport=MQTT_TRANSPORT, enabled=MQTT_ENABLED, stations=[demo_data.WIRED_STATION_ID],
)


def seed_demo_data(force=False):
    """Load demo_data.py into the store (always for in-memory, once per SEED_VERSION for MongoDB)."""
    meta = store.find_one("meta", id="seed") or {}
    if not force and store.using_mongo and meta.get("version") == demo_data.SEED_VERSION:
        return
    store.replace_all("users", demo_data.make_users())
    store.replace_all("stations", demo_data.make_stations())
    store.replace_all("transactions", demo_data.make_transactions())
    store.replace_all("alerts", demo_data.make_alerts())
    store.replace_all("anomalies", demo_data.make_anomalies())
    store.replace_all("settings", demo_data.make_settings())
    store.replace_all("orders", [])
    store.replace_all("meta", [{"id": "seed", "version": demo_data.SEED_VERSION}])
    log.info("🌱 Demo data loaded (seed version %s) into %s", demo_data.SEED_VERSION, store.name)


# ==================== RESPONSE HELPERS ====================

def ok(data=None, message=""):
    body = {"success": True, "message": message, "timestamp": datetime.now().isoformat()}
    body.update(data or {})
    return jsonify(body), 200


def fail(message, status=400):
    return jsonify({"success": False, "message": message, "timestamp": datetime.now().isoformat()}), status


@app.errorhandler(ServiceError)
def handle_service_error(error):
    return fail(str(error), 400)


def body():
    return request.get_json(silent=True) or {}


# =====================================================================
#   HEALTH
# =====================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    return ok({
        "status": "HEALTHY",
        "database": store.name,
        "usersCount": store.count("users"),
        "stationsCount": store.count("stations"),
        "mqtt": bridge.snapshot()["mqtt"],
        "razorpay": "test keys loaded" if payments.has_real_keys() else "no keys (simulated payments)",
    }, "AquaAllot API is running")


# =====================================================================
#   LIVE STATION  (Wokwi ESP32 over MQTT)
# =====================================================================

@app.route("/api/live", methods=["GET"])
def live_state():
    """Everything the Live Station page needs: MQTT status, station state and the event log."""
    return ok(bridge.snapshot())


@app.route("/api/stations/<station_id>/command", methods=["POST"])
def station_command(station_id):
    """Dashboard buttons → ESP32.  action = tap_card | start_order | stop | reset"""
    params = body()
    action = params.pop("action", None)
    order = bridge.command(station_id, action, **params)
    return ok({"order": order}, f"'{action}' sent to {station_id}")


@app.route("/api/orders/<order_id>", methods=["GET"])
def get_order(order_id):
    return ok({"order": services.get_order(store, order_id)})


@app.route("/api/orders/<order_id>/checkout", methods=["POST"])
def checkout_order(order_id):
    """Create the Razorpay order for a station order (opens the Razorpay popup on the dashboard)."""
    order = services.get_order(store, order_id)
    if order["status"] != "pending":
        raise ServiceError(f"Order is already {order['status']}")
    try:
        rzp = payments.create_razorpay_order(order["amount"], notes={"aquaallot_order": order_id, "user_id": order["userId"]})
    except Exception as error:
        return fail(f"Razorpay: {error}", 502)
    store.update("orders", {"id": order_id}, set={"razorpayOrderId": rzp["id"]})
    user = store.find_one("users", id=order["userId"]) or {}
    return ok({"razorpay": rzp, "order": order, "user": {"name": user.get("name"), "email": user.get("email")}})


@app.route("/api/orders/<order_id>/confirm", methods=["POST"])
def confirm_order_payment(order_id):
    """
    Called after the Razorpay popup succeeds (or for a demo 'test payment').
    Verifies the signature, marks the order paid and tells the ESP32 to open the valve.
    """
    data = body()
    if data.get("test_mode"):
        method, payment_id, rzp_order_id = "Test payment", None, None
    else:
        rzp_order_id = data.get("razorpay_order_id")
        payment_id = data.get("razorpay_payment_id")
        if not payments.signature_is_valid(rzp_order_id, payment_id, data.get("razorpay_signature")):
            return fail("Razorpay signature check failed", 400)
        method = "Razorpay"

    order, user = services.pay_order(store, order_id, method, payment_id=payment_id, razorpay_order_id=rzp_order_id)
    bridge.payment_confirmed(order, user)
    return ok({"order": order}, "Payment verified. Valve opening at the station.")


# =====================================================================
#   RFID + KIOSK PAYMENT FLOW  (used by the Kiosk and Dispensing pages)
# =====================================================================

@app.route("/api/verify_rfid", methods=["POST"])
def verify_rfid():
    uid = body().get("rfid_uid", "")
    log.info("🔐 RFID check from dashboard: %s", uid)
    try:
        user = services.check_card(store, uid)
    except ServiceError as error:
        return fail(str(error), 404)
    return ok({"authorized": True, "user": user}, "RFID authentication successful")


@app.route("/api/create_order", methods=["POST"])
def create_order():
    data = body()
    try:
        rzp = payments.create_razorpay_order(
            data.get("amount_rupees", 25),
            notes={"user_id": str(data.get("user_id", "")), "water_liters": str(data.get("water_liters", ""))},
        )
    except Exception as error:
        return fail(f"Razorpay: {error}", 502)
    return ok(rzp, "Order created")


@app.route("/api/verify_payment", methods=["POST"])
def verify_payment():
    """Kiosk/Dispensing pages: saves the transaction. (Usage is added later by /api/log_usage.)"""
    data = body()
    user = store.find_one("users", id=data.get("user_id")) or {}
    signature_ok = payments.signature_is_valid(
        data.get("razorpay_order_id"), data.get("razorpay_payment_id"), data.get("razorpay_signature")
    )
    amount = float(data.get("amount_rupees", 0))
    transaction = {
        "id": services.new_id("TXN"),
        "userId": user.get("id", data.get("user_id")), "userName": user.get("name", "User"),
        "hostelBlock": user.get("hostelBlock"), "rfid": user.get("rfid"),
        "amount": amount, "waterLiters": float(data.get("quantity_liters", 0)),
        "paymentStatus": "Paid", "dispensingStatus": "Completed",
        "paymentMethod": "Razorpay" if signature_ok else "Razorpay (test)",
        "razorpayPaymentId": data.get("razorpay_payment_id"), "razorpayOrderId": data.get("razorpay_order_id"),
        "stationId": data.get("station_id", demo_data.WIRED_STATION_ID), "timestamp": services.now_text(),
    }
    store.insert("transactions", transaction)
    if user:
        store.update("users", {"id": user["id"]}, inc={"totalSpent": amount})
    return ok({
        "verified": True, "signature_verified": signature_ok, "status": "Authorized",
        "payment_id": data.get("razorpay_payment_id"), "order_id": data.get("razorpay_order_id"),
        "dispensing_authorized": True, "transaction": transaction,
    }, "Payment saved. Water dispensing authorized.")


@app.route("/api/log_usage", methods=["POST"])
def log_usage():
    data = body()
    liters = float(data.get("water_liters", 0))
    station_id = data.get("station_id", demo_data.WIRED_STATION_ID)
    user = store.update("users", {"id": data.get("user_id")}, inc={"todayUsage": liters, "monthlyUsage": liters})
    store.update("stations", {"id": station_id}, inc={"todayUsage": liters})
    anomaly = services.detect_usage_anomaly(store, user, station_id)
    return ok({"logged": True, "anomaly": anomaly}, "Usage logged")


# =====================================================================
#   USERS
# =====================================================================

@app.route("/api/users", methods=["GET"])
def list_users():
    return ok({"users": store.all("users")})


@app.route("/api/users", methods=["POST"])
def create_user():
    data = body()
    card = services.pretty_card(data.get("rfid"))
    if not data.get("name") or not card:
        return fail("Name and RFID card UID are required")
    owner = services.find_user_by_card(store, card)
    if owner:
        return fail(f"Card {card} already belongs to {owner['name']}", 409)

    user = {
        "id": services.new_id("USR"), "name": data["name"], "email": data.get("email", ""),
        "hostelBlock": data.get("hostelBlock", "Hostel Block A"), "roomNo": data.get("roomNo", ""),
        "rfid": card, "rfidCard": data.get("rfidCard", "Registered from dashboard"),
        "balance": float(data.get("balance", 100)), "todayUsage": 0.0, "monthlyUsage": 0.0, "totalSpent": 0.0,
        "avgDailyUsage": float(data.get("avgDailyUsage", 2.5)), "usageStdDev": 0.6, "status": "Active",
        "avatar": demo_data.avatar(data["name"]),
    }
    store.insert("users", user)
    log.info("👤 New user %s with card %s", user["name"], card)
    return ok({"user": user}, f"{user['name']} registered with card {card}")


@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = store.find_one("users", id=user_id)
    return ok({"user": user}) if user else fail("User not found", 404)


@app.route("/api/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    allowed = ("name", "email", "hostelBlock", "roomNo", "status", "avgDailyUsage")
    changes = {key: value for key, value in body().items() if key in allowed}
    user = store.update("users", {"id": user_id}, set=changes)
    return ok({"user": user}) if user else fail("User not found", 404)


@app.route("/api/users/<user_id>/topup", methods=["POST"])
def topup_user_balance(user_id):
    amount = float(body().get("amount", 100))
    if amount <= 0:
        return fail("Amount must be positive")
    user = store.update("users", {"id": user_id}, inc={"balance": amount})
    return ok({"user": user}, f"Added ₹{amount:.0f} to wallet") if user else fail("User not found", 404)


# =====================================================================
#   TRANSACTIONS, STATIONS, ALERTS, SETTINGS
# =====================================================================

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    return ok({"transactions": store.all("transactions")})


@app.route("/api/stations", methods=["GET"])
def get_stations():
    stations = [{**s, **bridge.station_overrides(s["id"])} for s in store.all("stations")]
    return ok({"stations": stations})


@app.route("/api/stations/<station_id>", methods=["GET"])
def get_station(station_id):
    station = store.find_one("stations", id=station_id)
    if not station:
        return fail("Station not found", 404)
    return ok({"station": {**station, **bridge.station_overrides(station_id)}})


@app.route("/api/stations/<station_id>/telemetry", methods=["POST"])
def station_telemetry(station_id):
    """Optional HTTP telemetry (the Wokwi station uses MQTT instead)."""
    data = body()
    changes = {}
    if "flow_rate_lpm" in data:
        changes["flowRate"] = data["flow_rate_lpm"]
    if "solenoid_valve" in data:
        changes["solenoidValve"] = "Open" if str(data["solenoid_valve"]).upper() == "OPEN" else "Closed"
    store.update("stations", {"id": station_id}, set=changes)
    return ok({"telemetry_logged": True})


@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    return ok({"alerts": store.all("alerts"), "anomalies": store.all("anomalies")})


@app.route("/api/alerts", methods=["POST"])
def create_alert():
    data = body()
    alert = services.raise_alert(
        store, data.get("severity", "Critical"), data.get("title", "System Warning"),
        data.get("reason") or data.get("description", "Alert triggered"),
        data.get("station_id", demo_data.WIRED_STATION_ID), data.get("user_id"),
    )
    return ok({"alert": alert}, "Alert saved")


@app.route("/api/alerts/<alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    alert = store.update("alerts", {"id": alert_id}, set={"status": "Resolved"})
    return ok({"alert": alert}, "Alert resolved") if alert else fail("Alert not found", 404)


@app.route("/api/settings", methods=["GET"])
def get_settings():
    return ok({"settings": store.find_one("settings", id="global") or {}})


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    price = float(body().get("waterPricePerLiter", 0))
    if price <= 0:
        return fail("Price must be positive")
    settings = store.update("settings", {"id": "global"}, set={"waterPricePerLiter": price})
    return ok({"settings": settings}, f"Water price set to ₹{price:g}/L")


@app.route("/api/admin/reset_demo", methods=["POST"])
def reset_demo():
    seed_demo_data(force=True)
    return ok(message="Demo data reset")


# =====================================================================
#   START
# =====================================================================

seed_demo_data()
bridge.start()

if __name__ == "__main__":
    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║  %-56s║", f"AquaAllot backend  →  http://localhost:{PORT}/api/health")
    log.info("║  Database : %-45s║", store.name)
    log.info("║  MQTT     : %-45s║", f"{MQTT_BROKER}:{MQTT_PORT}")
    log.info("║  Topic    : %-45s║", f"{MQTT_TOPIC_ROOT}/<station>/up|down")
    log.info("║  Razorpay : %-45s║", "test keys loaded" if payments.has_real_keys() else "no keys → simulated")
    log.info("╚══════════════════════════════════════════════════════════╝")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
