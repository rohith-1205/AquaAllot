"""
services.py - the business rules of AquaAllot, in one place.

Both the HTTP routes (dashboard) and the MQTT bridge (Wokwi ESP32) call
these functions, so a payment made on the dashboard and a payment made
with the PAY button follow exactly the same rules.

Life of one water order:

    check_card()  ->  create_order()  ->  pay_order()  ->  finish_order()
     (RFID tap)       (1/2/5 L picked)   (Wallet/Razorpay)  (valve closed, litres measured)
"""

import functools
import logging
import uuid
from datetime import datetime

log = logging.getLogger("aquaallot.services")

MAX_LITERS_PER_ORDER = 20


class ServiceError(Exception):
    """A rule was broken. The message is short enough to show on the OLED (max ~20 chars)."""


# =====================================================================
#   Small helpers
# =====================================================================

def atomic(func):
    """Run the whole rule while holding the store lock, so two payments for one order can't race."""
    @functools.wraps(func)
    def wrapper(store, *args, **kwargs):
        with store.lock:
            return func(store, *args, **kwargs)
    return wrapper


def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


def now_text():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def normalize_card(uid):
    """'01:02:03:04', '01 02 03 04' and '01020304' are all the same card."""
    return "".join(ch for ch in str(uid or "").upper() if ch.isalnum())


def pretty_card(uid):
    """'01020304' -> '01:02:03:04' (how the Wokwi reader prints it)."""
    clean = normalize_card(uid)
    return ":".join(clean[i:i + 2] for i in range(0, len(clean), 2))


def water_price(store):
    settings = store.find_one("settings", id="global") or {}
    return float(settings.get("waterPricePerLiter", 5))


def public_user(user):
    """Only the fields the station/dashboard needs about the person at the tap."""
    if not user:
        return None
    return {
        "id": user["id"], "name": user["name"], "balance": round(float(user.get("balance", 0)), 2),
        "avatar": user.get("avatar"), "hostelBlock": user.get("hostelBlock"),
        "todayUsage": user.get("todayUsage", 0), "rfid": user.get("rfid"),
    }


# =====================================================================
#   1. RFID card check
# =====================================================================

def find_user_by_card(store, uid):
    wanted = normalize_card(uid)
    if not wanted:
        return None
    return next((u for u in store.all("users") if normalize_card(u.get("rfid")) == wanted), None)


def check_card(store, uid):
    """Returns the user for this card, or raises ServiceError with the reason."""
    user = find_user_by_card(store, uid)
    if not user:
        raise ServiceError("Unknown card")
    if user.get("status") in ("Suspended", "Inactive"):
        raise ServiceError("Account suspended")
    return user


# =====================================================================
#   2. Orders
# =====================================================================

@atomic
def create_order(store, user, liters, station_id, source):
    """Create a 'pending' order (waiting for payment). Cancels older pending orders at this station."""
    liters = float(liters)
    if liters <= 0 or liters > MAX_LITERS_PER_ORDER:
        raise ServiceError("Invalid quantity")

    for old in store.find("orders", stationId=station_id, status="pending"):
        store.update("orders", {"id": old["id"]}, set={"status": "cancelled"})

    order = {
        "id": new_id("ORD"),
        "userId": user["id"], "userName": user["name"],
        "stationId": station_id, "source": source,              # 'esp32' or 'dashboard'
        "liters": liters, "amount": round(liters * water_price(store), 2),
        "status": "pending",                                      # pending -> paid -> completed / stopped
        "paymentMethod": None, "razorpayOrderId": None, "txnId": None,
        "dispensedLiters": 0.0, "createdAt": now_text(),
    }
    store.insert("orders", order)
    log.info("🧾 Order %s: %s wants %.1f L (₹%.0f) at %s", order["id"], user["name"], liters, order["amount"], station_id)
    return order


def get_order(store, order_id):
    order = store.find_one("orders", id=order_id)
    if not order:
        raise ServiceError("Order not found")
    return order


@atomic
def cancel_order(store, order_id):
    order = store.find_one("orders", id=order_id)
    if order and order["status"] == "pending":
        store.update("orders", {"id": order_id}, set={"status": "cancelled"})


# =====================================================================
#   3. Payment
# =====================================================================

@atomic
def pay_order(store, order_id, method, payment_id=None, razorpay_order_id=None):
    """
    Mark an order as paid and create its transaction.
    method = 'Wallet' (PAY button), 'Razorpay' (dashboard) or 'Test payment'.
    """
    order = get_order(store, order_id)
    if order["status"] != "pending":
        raise ServiceError(f"Order is {order['status']}")

    user = store.find_one("users", id=order["userId"])
    if not user:
        raise ServiceError("User not found")

    if method == "Wallet":
        if float(user.get("balance", 0)) < order["amount"]:
            raise ServiceError("Low wallet balance")
        user = store.update("users", {"id": user["id"]}, inc={"balance": -order["amount"]})

    store.update("users", {"id": user["id"]}, inc={"totalSpent": order["amount"]})

    transaction = {
        "id": new_id("TXN"),
        "userId": user["id"], "userName": user["name"], "hostelBlock": user.get("hostelBlock"),
        "rfid": user.get("rfid"),
        "amount": order["amount"], "waterLiters": order["liters"],
        "paymentStatus": "Paid", "dispensingStatus": "Dispensing", "paymentMethod": method,
        "razorpayPaymentId": payment_id, "razorpayOrderId": razorpay_order_id,
        "orderId": order["id"], "stationId": order["stationId"], "timestamp": now_text(),
    }
    store.insert("transactions", transaction)

    order = store.update("orders", {"id": order_id}, set={
        "status": "paid", "paymentMethod": method, "txnId": transaction["id"],
        "razorpayOrderId": razorpay_order_id or order.get("razorpayOrderId"),
    })
    log.info("✅ Order %s paid by %s (₹%.0f)", order_id, method, order["amount"])
    return order, store.find_one("users", id=user["id"])


# =====================================================================
#   4. Finish dispensing
# =====================================================================

@atomic
def finish_order(store, order_id, liters, result="done", reason=""):
    """
    Called when the valve closes. result = 'done' | 'stopped' | 'anomaly'.
    Updates the transaction, user usage, station usage and runs the anomaly check.
    """
    order = get_order(store, order_id)
    if order["status"] in ("completed", "stopped"):
        return {"order": order, "user": store.find_one("users", id=order["userId"]), "anomaly": None}
    if order["status"] != "paid":
        raise ServiceError("Order not paid")

    liters = round(max(0.0, min(float(liters), order["liters"] * 1.1)), 2)
    finished_ok = result == "done"

    order = store.update("orders", {"id": order_id}, set={
        "status": "completed" if finished_ok else "stopped", "dispensedLiters": liters,
    })
    store.update("transactions", {"id": order["txnId"]}, set={
        "waterLiters": liters,
        "dispensingStatus": "Completed" if finished_ok else f"Stopped: {reason or result}",
    })
    user = store.update("users", {"id": order["userId"]}, inc={"todayUsage": liters, "monthlyUsage": liters})
    store.update("stations", {"id": order["stationId"]}, inc={"todayUsage": liters})

    if not finished_ok:
        raise_alert(
            store,
            severity="Critical" if result == "anomaly" else "Warning",
            title="Dispensing Stopped" if result == "stopped" else "Anomaly During Dispensing",
            description=f"{order['userName']}: {reason or result} after {liters} L of {order['liters']} L.",
            station_id=order["stationId"], user_id=order["userId"],
        )

    anomaly = detect_usage_anomaly(store, user, order["stationId"])
    log.info("💧 Order %s finished: %.2f L (%s)", order_id, liters, result)
    return {"order": order, "user": store.find_one("users", id=order["userId"]), "anomaly": anomaly}


# =====================================================================
#   5. Anomaly detection (3-sigma rule) and alerts
# =====================================================================

def detect_usage_anomaly(store, user, station_id):
    """
    "AI" usage check: a student's water use today is abnormal when it is
    more than 3 standard deviations above their own daily average.

        threshold = average + 3 x std-dev
    """
    if not user:
        return None
    mean = float(user.get("avgDailyUsage") or 2.5)
    std_dev = float(user.get("usageStdDev") or 0.6)
    threshold = round(mean + 3 * std_dev, 1)
    observed = round(float(user.get("todayUsage") or 0), 2)

    if observed <= threshold:
        return None

    deviation = round(((observed - mean) / mean) * 100) if mean else 0
    anomaly = {
        "id": new_id("ANOM"),
        "userId": user["id"], "userName": user["name"], "hostelBlock": user.get("hostelBlock"),
        "mean": mean, "stdDev": std_dev, "upperThreshold": threshold, "observed": observed,
        "deviation": f"+{deviation}%", "severity": "Critical",
        "reason": f"Used {observed} L today. Normal is {mean} L/day; the 3-sigma limit is {threshold} L.",
        "timestamp": now_text(), "status": "Investigating", "stationId": station_id,
    }
    store.insert("anomalies", anomaly)
    if user.get("status") == "Active":
        store.update("users", {"id": user["id"]}, set={"status": "Warning"})
    raise_alert(
        store, severity="Critical", title="Unusual Consumption Spike",
        description=f"{user['name']} used {observed} L today (limit {threshold} L, {anomaly['deviation']} above normal).",
        station_id=station_id, user_id=user["id"],
    )
    log.warning("🚨 Anomaly: %s used %.2f L today (limit %.1f L)", user["name"], observed, threshold)
    return anomaly


def raise_alert(store, severity, title, description, station_id, user_id=None):
    alert = {
        "id": new_id("ALT"), "severity": severity, "title": title, "description": description,
        "timestamp": now_text(), "stationId": station_id, "userId": user_id, "status": "Unresolved",
    }
    store.insert("alerts", alert)
    log.warning("⚠️  Alert [%s] %s - %s", severity, title, description)
    return alert
