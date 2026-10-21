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


def limit_arg(default=200):
    """?limit=50 on list endpoints (newest first). Keeps responses small as data grows."""
    try:
        return max(1, min(int(request.args.get("limit", default)), 1000))
    except ValueError:
        return default


def verified_payment(data):
    """
    Checks a Razorpay payment from the browser.
    Returns (payment_id, method) or raises ServiceError.
    Without Razorpay keys in backend/.env, a simulated payment is accepted (demo mode).
    """
    if not payments.has_real_keys():
        return f"sim_{services.new_id('PAY')}", "Simulated (no Razorpay keys)"
    if not payments.signature_is_valid(data.get("razorpay_order_id"), data.get("razorpay_payment_id"), data.get("razorpay_signature")):
        raise ServiceError("Razorpay signature check failed")
    return data["razorpay_payment_id"], "Razorpay"


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
    """Step 1: create the Razorpay order for this water order (opens the Razorpay popup on the dashboard)."""
    order = services.get_order(store, order_id)
    if order["status"] != "pending":
        raise ServiceError(f"Order is already {order['status']}")
    try:
        rzp = payments.create_razorpay_order(order["amount"], notes={"aquaallot_order": order_id, "user_id": order["userId"]})
    except Exception as error:
        return fail(f"Razorpay: {error}", 502)
    services.attach_razorpay_order(store, order_id, rzp["id"])
    user = store.find_one("users", id=order["userId"]) or {}
    return ok({"razorpay": rzp, "order": order, "user": {"name": user.get("name"), "email": user.get("email")}})


@app.route("/api/orders/<order_id>/confirm", methods=["POST"])
def confirm_order(order_id):
    """
    Step 2: after the Razorpay popup succeeds → verify the signature → mark paid
    → tell the ESP32 to open the valve.
    """
    data = body()
    order = services.get_order(store, order_id)
    if payments.has_real_keys() and data.get("razorpay_order_id") != order.get("razorpayOrderId"):
        raise ServiceError("Payment does not belong to this order")
    payment_id, method = verified_payment(data)
    try:
        payments.ensure_captured(payment_id, order["amount"])   # refunds need a captured payment
    except Exception as error:
        log.warning("Could not capture payment %s yet: %s", payment_id, error)
    order, user = services.pay_order(store, order_id, payment_id, order.get("razorpayOrderId"), method)
    bridge.payment_confirmed(order, user)
    return ok({"order": order}, "Payment verified. Valve opening at the station.")


# =====================================================================
#   RFID CHECK (Kiosk page "RFID card" box)
# =====================================================================

@app.route("/api/verify_rfid", methods=["POST"])
def verify_rfid():
    uid = body().get("rfid_uid", "")
    try:
        user = services.check_card(store, uid)
    except ServiceError as error:
        return fail(str(error), 404)
    return ok({"authorized": True, "user": user}, "RFID authentication successful")


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
        "todayUsage": 0.0, "monthlyUsage": 0.0, "totalSpent": 0.0,
        "avgDailyUsage": float(data.get("avgDailyUsage", 2.5)), "usageStdDev": 0.6,
        "dailyQuota": float(data.get("dailyQuota") or services.settings(store).get("dailyQuotaLiters", 10)),
        "status": "Active", "avatar": demo_data.avatar(data["name"]), "createdAt": services.now_iso(),
    }
    store.insert("users", user)
    log.info("👤 New user %s with card %s", user["name"], card)
    return ok({"user": user}, f"{user['name']} registered with card {card}")


@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = store.find_one("users", id=user_id)
    if not user:
        return fail("User not found", 404)
    return ok({"user": user, "profile": services.usage_profile(store, user)})


@app.route("/api/users/<user_id>/usage", methods=["GET"])
def get_user_usage(user_id):
    """Litres per day for the last 7 days (User Details chart)."""
    return ok({"usage": services.user_usage_history(store, user_id, days=7)})


@app.route("/api/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    allowed = ("name", "email", "hostelBlock", "roomNo", "status", "avgDailyUsage", "dailyQuota")
    changes = {key: value for key, value in body().items() if key in allowed}
    user = store.update("users", {"id": user_id}, set=changes)
    return ok({"user": user}) if user else fail("User not found", 404)


# =====================================================================
#   TRANSACTIONS, ANALYTICS, STATIONS, ALERTS, SETTINGS
# =====================================================================

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    return ok({"transactions": store.all("transactions", limit=limit_arg())})


@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    """Every number and chart on the Dashboard / Analytics pages, calculated from real transactions."""
    data = services.analytics(store)
    live_stations = [s for s in store.all("stations") if s.get("isLive")]
    online = sum(1 for s in live_stations if bridge.station_overrides(s["id"]).get("status") in ("Online", "Warning"))
    data["kpis"].update({"liveStationsOnline": online, "liveStationsTotal": len(live_stations)})
    return ok(data)


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


@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    limit = limit_arg(100)
    return ok({"alerts": store.all("alerts", limit=limit), "anomalies": store.all("anomalies", limit=limit)})


@app.route("/api/alerts/<alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    alert = store.update("alerts", {"id": alert_id}, set={"status": "Resolved", "resolvedAt": services.now_iso()})
    return ok({"alert": alert}, "Alert resolved") if alert else fail("Alert not found", 404)


@app.route("/api/settings", methods=["GET"])
def get_settings():
    return ok({"settings": services.settings(store)})


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    data = body()
    changes = {}
    if "waterPricePerLiter" in data:
        price = float(data["waterPricePerLiter"] or 0)
        if price <= 0:
            return fail("Price must be positive")
        changes["waterPricePerLiter"] = price
    if "dailyQuotaLiters" in data:
        quota = float(data["dailyQuotaLiters"] or 0)
        if quota <= 0:
            return fail("Daily quota must be positive")
        changes["dailyQuotaLiters"] = quota
        store.update_many("users", set={"dailyQuota": quota})   # same allotment for everyone
    settings = store.update("settings", {"id": "global"}, set=changes)
    return ok({"settings": settings}, "Settings saved")


@app.route("/api/admin/reset_demo", methods=["POST"])
def reset_demo():
    seed_demo_data(force=True)
    return ok(message="Demo data reset")


# =====================================================================
#   START
# =====================================================================

seed_demo_data()
services.roll_over_day(store)
bridge.start()
bridge.start_housekeeping()

if __name__ == "__main__":
    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║  %-56s║", f"AquaAllot backend  →  http://localhost:{PORT}/api/health")
    log.info("║  Database : %-45s║", store.name)
    log.info("║  MQTT     : %-45s║", f"{MQTT_BROKER}:{MQTT_PORT} ({MQTT_TRANSPORT})")
    log.info("║  Topic    : %-45s║", f"{MQTT_TOPIC_ROOT}/<station>/up|down")
    log.info("║  Razorpay : %-45s║", "test keys loaded" if payments.has_real_keys() else "no keys → simulated")
    log.info("╚══════════════════════════════════════════════════════════╝")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
