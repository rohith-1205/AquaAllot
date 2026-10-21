"""
services.py - the business rules of AquaAllot, in one place.

Both the HTTP routes (dashboard) and the MQTT bridge (Wokwi ESP32) call
these functions, so a payment made on the dashboard and a payment made
with the PAY button follow exactly the same rules.

Money rules (prepaid wallet):
    • Water is ALWAYS paid from the student's wallet.
    • Money gets INTO the wallet only through a verified Razorpay top-up.
    • Paying an order reserves the full amount; when the valve closes the
      student is charged only for the litres actually dispensed and the
      rest goes back to the wallet. A stuck order is refunded completely.

Life of one water order:

    check_card() → create_order() → pay_order() → finish_order()   (or fail_order() → refund)
     (RFID tap)    (1/2/5 L)        (wallet)       (valve closed)
"""

import functools
import logging
import statistics
import uuid
from datetime import datetime, timedelta

log = logging.getLogger("aquaallot.services")

MAX_LITERS_PER_ORDER = 20
MIN_TOPUP, MAX_TOPUP = 10, 5000         # ₹ per Razorpay top-up
STUCK_ORDER_SECONDS = 60                # paid, but no water reported for this long → refund
PENDING_ORDER_MINUTES = 15              # unpaid orders expire after this
HISTORY_DAYS = 30                       # how far back the usage baseline looks
MIN_HISTORY_DAYS = 5                    # fewer days than this → use the starting values


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


def now():
    return datetime.now().replace(microsecond=0)


def now_iso():
    """Every timestamp is stored in ISO 8601: 2026-10-21T18:24:05"""
    return now().isoformat()


def today():
    return now().strftime("%Y-%m-%d")


def parse_time(text):
    """ISO text → datetime (None for missing / old free-text values like 'Just now')."""
    try:
        return datetime.fromisoformat(str(text))
    except (TypeError, ValueError):
        return None


def money(value):
    return round(float(value or 0), 2)


def normalize_card(uid):
    """'01:02:03:04', '01 02 03 04' and '01020304' are all the same card."""
    return "".join(ch for ch in str(uid or "").upper() if ch.isalnum())


def pretty_card(uid):
    """'01020304' -> '01:02:03:04' (how the Wokwi reader prints it)."""
    clean = normalize_card(uid)
    return ":".join(clean[i:i + 2] for i in range(0, len(clean), 2))


def settings(store):
    return store.find_one("settings", id="global") or {}


def water_price(store):
    return float(settings(store).get("waterPricePerLiter", 5))


def daily_quota(store, user):
    return float(user.get("dailyQuota") or settings(store).get("dailyQuotaLiters", 10))


def public_user(user):
    """Only the fields the station/dashboard needs about the person at the tap."""
    if not user:
        return None
    return {
        "id": user["id"], "name": user["name"], "balance": money(user.get("balance")),
        "avatar": user.get("avatar"), "hostelBlock": user.get("hostelBlock"),
        "todayUsage": user.get("todayUsage", 0), "rfid": user.get("rfid"), "email": user.get("email"),
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
#   2. Normal usage + over-usage alerts
# =====================================================================

def usage_profile(store, user, transactions=None):
    """
    How much water this student normally uses per day, learned from their
    last 30 days of purchases (days they bought water, today excluded).

        limit = average + 3 × standard deviation      ("3-sigma rule")

    With less than 5 days of history we use the starting values from the user record.
    """
    transactions = transactions if transactions is not None else store.all("transactions")
    since = (now() - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")
    per_day = {}
    for txn in transactions:
        day = str(txn.get("timestamp", ""))[:10]
        if txn.get("userId") == user["id"] and since <= day < today():
            per_day[day] = per_day.get(day, 0) + float(txn.get("waterLiters") or 0)

    learned = len(per_day) >= MIN_HISTORY_DAYS
    if learned:
        mean = statistics.mean(per_day.values())
        std_dev = max(0.3, statistics.pstdev(per_day.values()))
    else:
        mean = float(user.get("avgDailyUsage") or 2.5)
        std_dev = float(user.get("usageStdDev") or 0.6)

    return {
        "mean": round(mean, 2), "stdDev": round(std_dev, 2),
        "limit": round(mean + 3 * std_dev, 1), "quota": daily_quota(store, user),
        "historyDays": len(per_day), "learned": learned,
    }


def check_usage(store, user, liters, station_id):
    """
    Called BEFORE an order is created. Raises one alert per student per day
    on the admin dashboard when today's usage (including this order) goes
    above their normal limit or above the daily quota. The order is still allowed.

    Returns a short warning for the OLED ('' when everything is normal).
    """
    profile = usage_profile(store, user)
    after = round(float(user.get("todayUsage") or 0) + float(liters), 2)
    warnings = []

    if after > profile["limit"]:
        warnings.append("Above normal use")
        key = f"spike-{user['id']}-{today()}"
        deviation = round((after - profile["mean"]) / profile["mean"] * 100) if profile["mean"] else 0
        if not store.find_one("anomalies", dedupeKey=key):
            store.insert("anomalies", {
                "id": new_id("ANOM"), "dedupeKey": key,
                "userId": user["id"], "userName": user["name"], "hostelBlock": user.get("hostelBlock"),
                "mean": profile["mean"], "stdDev": profile["stdDev"], "upperThreshold": profile["limit"],
                "observed": after, "deviation": f"+{deviation}%", "severity": "Critical",
                "reason": f"{after} L today vs normal {profile['mean']} L/day (3-sigma limit {profile['limit']} L).",
                "timestamp": now_iso(), "status": "Investigating", "stationId": station_id,
            })
        raise_alert(
            store, "Critical", "Unusual Consumption Spike",
            f"{user['name']} ordered {float(liters):g} L → {after} L today. Normal is {profile['mean']} L/day, 3-sigma limit {profile['limit']} L.",
            station_id, user["id"], dedupe_key=key,
        )

    if after > profile["quota"]:
        warnings.append("Over daily quota")
        raise_alert(
            store, "Warning", "Daily Quota Exceeded",
            f"{user['name']} ordered {float(liters):g} L → {after} L today, above the daily allotment of {profile['quota']:g} L.",
            station_id, user["id"], dedupe_key=f"quota-{user['id']}-{today()}",
        )

    if warnings and user.get("status") == "Active":
        store.update("users", {"id": user["id"]}, set={"status": "Warning"})
    return warnings[0] if warnings else ""


# =====================================================================
#   3. Orders
# =====================================================================

@atomic
def create_order(store, user, liters, station_id, source):
    """Create a 'pending' order (waiting for payment). Cancels older pending orders at this station."""
    liters = float(liters)
    if liters <= 0 or liters > MAX_LITERS_PER_ORDER:
        raise ServiceError("Invalid quantity")

    for old in store.find("orders", stationId=station_id, status="pending"):
        store.update("orders", {"id": old["id"]}, set={"status": "cancelled"})

    warning = check_usage(store, user, liters, station_id)
    order = {
        "id": new_id("ORD"),
        "userId": user["id"], "userName": user["name"],
        "stationId": station_id, "source": source,              # 'esp32' or 'dashboard'
        "liters": liters, "amount": money(liters * water_price(store)),
        "status": "pending",                     # pending → paid → completed / stopped / failed (or cancelled)
        "warning": warning,
        "txnId": None, "dispensedLiters": 0.0, "charged": 0.0, "refund": 0.0,
        "createdAt": now_iso(), "paidAt": None,
    }
    store.insert("orders", order)
    log.info("🧾 Order %s: %s wants %.1f L (₹%.0f) at %s %s", order["id"], user["name"], liters,
             order["amount"], station_id, f"⚠ {warning}" if warning else "")
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
#   4. Paying an order (always from the wallet)
# =====================================================================

@atomic
def pay_order(store, order_id, via):
    """
    Take the order amount from the wallet (reserved until the valve closes).
    via = 'Station PAY button' or 'Dashboard'.
    """
    order = get_order(store, order_id)
    if order["status"] != "pending":
        raise ServiceError(f"Order is {order['status']}")

    user = store.find_one("users", id=order["userId"])
    if not user:
        raise ServiceError("User not found")
    if money(user.get("balance")) < order["amount"]:
        raise ServiceError("Low wallet balance")

    user = store.update("users", {"id": user["id"]}, inc={"balance": -order["amount"]})

    transaction = {
        "id": new_id("TXN"),
        "userId": user["id"], "userName": user["name"], "hostelBlock": user.get("hostelBlock"),
        "rfid": user.get("rfid"),
        "amount": order["amount"], "waterLiters": order["liters"], "refund": 0.0,
        "paymentStatus": "Paid", "dispensingStatus": "Dispensing",
        "paymentMethod": "Wallet", "paidVia": via,
        "orderId": order["id"], "stationId": order["stationId"], "timestamp": now_iso(),
    }
    store.insert("transactions", transaction)

    order = store.update("orders", {"id": order_id}, set={
        "status": "paid", "paidAt": now_iso(), "txnId": transaction["id"],
    })
    log.info("✅ Order %s paid from wallet via %s (₹%.0f, wallet now ₹%.0f)", order_id, via, order["amount"], user["balance"])
    return order, user


# =====================================================================
#   5. Wallet top-ups (Razorpay)
# =====================================================================

@atomic
def create_topup(store, user_id, amount, razorpay_order_id):
    amount = money(amount)
    if amount < MIN_TOPUP or amount > MAX_TOPUP:
        raise ServiceError(f"Top-up must be ₹{MIN_TOPUP}–₹{MAX_TOPUP}")
    user = store.find_one("users", id=user_id)
    if not user:
        raise ServiceError("User not found")
    topup = {
        "id": new_id("TOP"), "userId": user["id"], "userName": user["name"],
        "amount": amount, "status": "pending", "method": None,
        "razorpayOrderId": razorpay_order_id, "razorpayPaymentId": None,
        "createdAt": now_iso(), "paidAt": None,
    }
    store.insert("topups", topup)
    return topup


@atomic
def complete_topup(store, topup_id, payment_id, method):
    """Money arrives in the wallet. Only call this after the Razorpay signature was verified."""
    topup = store.find_one("topups", id=topup_id)
    if not topup:
        raise ServiceError("Top-up not found")
    if topup["status"] != "pending":
        raise ServiceError("Top-up already used")
    user = store.update("users", {"id": topup["userId"]}, inc={"balance": topup["amount"]})
    topup = store.update("topups", {"id": topup_id}, set={
        "status": "paid", "method": method, "razorpayPaymentId": payment_id, "paidAt": now_iso(),
    })
    log.info("💳 Top-up %s: ₹%.0f added to %s's wallet (now ₹%.0f)", topup_id, topup["amount"], user["name"], user["balance"])
    return topup, user


# =====================================================================
#   6. Finishing, refunds and stuck orders
# =====================================================================

@atomic
def finish_order(store, order_id, liters, result="done", reason=""):
    """
    Called when the valve closes. result = 'done' | 'stopped' | 'anomaly'.
    Charges only the litres actually dispensed and refunds the rest to the wallet.
    """
    order = get_order(store, order_id)
    if order["status"] in ("completed", "stopped", "failed"):
        return {"order": order, "user": store.find_one("users", id=order["userId"]),
                "charged": order.get("charged", 0), "refund": order.get("refund", 0)}
    if order["status"] != "paid":
        raise ServiceError("Order not paid")

    dispensed = round(max(0.0, min(float(liters), order["liters"] * 1.1)), 2)
    charged_liters = min(dispensed, order["liters"])
    charged = money(order["amount"] * charged_liters / order["liters"])
    refund = money(order["amount"] - charged)
    finished_ok = result == "done"

    user = store.update("users", {"id": order["userId"]}, inc={
        "balance": refund, "todayUsage": dispensed, "monthlyUsage": dispensed, "totalSpent": charged,
    })
    store.update("stations", {"id": order["stationId"]}, inc={"todayUsage": dispensed})
    store.update("transactions", {"id": order["txnId"]}, set={
        "amount": charged, "waterLiters": dispensed, "refund": refund,
        "paymentStatus": "Paid" if refund == 0 else "Partly refunded",
        "dispensingStatus": "Completed" if finished_ok else f"Stopped: {reason or result}",
    })
    order = store.update("orders", {"id": order_id}, set={
        "status": "completed" if finished_ok else "stopped",
        "dispensedLiters": dispensed, "charged": charged, "refund": refund,
    })

    if not finished_ok:
        raise_alert(
            store,
            severity="Critical" if result == "anomaly" else "Warning",
            title="Dispensing Stopped" if result == "stopped" else "Anomaly During Dispensing",
            description=f"{order['userName']}: {reason or result} after {dispensed} L of {order['liters']:g} L. ₹{refund:g} refunded to wallet.",
            station_id=order["stationId"], user_id=order["userId"],
        )
    log.info("💧 Order %s finished: %.2f L, charged ₹%.2f, refunded ₹%.2f (%s)", order_id, dispensed, charged, refund, result)
    return {"order": order, "user": user, "charged": charged, "refund": refund}


@atomic
def fail_order(store, order_id, reason):
    """A paid order that never dispensed (station offline / reset / no flow): refund everything."""
    order = get_order(store, order_id)
    if order["status"] != "paid":
        return None
    user = store.update("users", {"id": order["userId"]}, inc={"balance": order["amount"]})
    store.update("transactions", {"id": order["txnId"]}, set={
        "amount": 0.0, "waterLiters": 0.0, "refund": order["amount"],
        "paymentStatus": "Refunded", "dispensingStatus": f"Failed: {reason}",
    })
    order = store.update("orders", {"id": order_id}, set={"status": "failed", "refund": order["amount"]})
    raise_alert(
        store, "Warning", "Order Refunded",
        f"{order['userName']}'s order {order_id} ({order['liters']:g} L) never dispensed – {reason}. ₹{order['amount']:g} returned to wallet.",
        order["stationId"], order["userId"],
    )
    return order, user


def housekeeping(store, last_activity):
    """
    Runs every few seconds (station_bridge watchdog):
      • new day → reset today's usage
      • unpaid orders older than 15 min → cancelled
      • paid orders with no water for 60 s → failed + full refund
    `last_activity` = {order_id: epoch seconds of the last progress message}
    Returns the refunded orders so the bridge can log them.
    """
    roll_over_day(store)
    refunded = []
    moment = now()
    for order in store.all("orders", limit=200):
        if order["status"] == "pending":
            created = parse_time(order.get("createdAt"))
            if created and moment - created > timedelta(minutes=PENDING_ORDER_MINUTES):
                cancel_order(store, order["id"])
        elif order["status"] == "paid":
            paid = parse_time(order.get("paidAt"))
            last = max(paid.timestamp() if paid else 0, last_activity.get(order["id"], 0))
            if moment.timestamp() - last > STUCK_ORDER_SECONDS:
                result = fail_order(store, order["id"], "no water flow reported by the station")
                if result:
                    refunded.append(result[0])
    return refunded


@atomic
def roll_over_day(store):
    """At the first call of a new day, start everyone's 'today' usage from zero."""
    current = settings(store)
    if current.get("usageDate") == today():
        return False
    store.update_many("users", set={"todayUsage": 0.0})
    store.update_many("stations", set={"todayUsage": 0.0})
    for user in store.find("users", status="Warning"):          # yesterday's warnings expire
        store.update("users", {"id": user["id"]}, set={"status": "Active"})
    store.update("settings", {"id": "global"}, set={"usageDate": today()})
    log.info("📅 New day %s: today's usage reset for all students and stations", today())
    return True


# =====================================================================
#   7. Sales made while the station was offline
# =====================================================================

@atomic
def record_offline_sale(store, sale_id, card_uid, liters, amount, station_id, seconds_ago=0):
    """The ESP32 sends cash sales it made in OFFLINE MODE once it is back online."""
    if store.find_one("transactions", saleId=sale_id):
        return None   # already saved (message was sent twice)
    user = find_user_by_card(store, card_uid) or {}
    liters, amount = round(float(liters), 2), money(amount)
    moment = now() - timedelta(seconds=max(0, int(seconds_ago)))
    transaction = {
        "id": new_id("TXN"), "saleId": sale_id,
        "userId": user.get("id"), "userName": user.get("name", f"Card {pretty_card(card_uid)}"),
        "hostelBlock": user.get("hostelBlock"), "rfid": pretty_card(card_uid),
        "amount": amount, "waterLiters": liters, "refund": 0.0,
        "paymentStatus": "Paid", "dispensingStatus": "Completed", "paymentMethod": "Cash (offline)",
        "orderId": None, "stationId": station_id, "timestamp": moment.isoformat(),
    }
    store.insert("transactions", transaction)
    if user:
        today_part = liters if moment.strftime("%Y-%m-%d") == today() else 0.0
        store.update("users", {"id": user["id"]}, inc={"todayUsage": today_part, "monthlyUsage": liters, "totalSpent": amount})
    store.update("stations", {"id": station_id}, inc={"todayUsage": liters if moment.strftime("%Y-%m-%d") == today() else 0.0})
    log.info("📦 Offline sale %s saved: %s, %.2f L, ₹%.0f", sale_id, transaction["userName"], liters, amount)
    return transaction


# =====================================================================
#   8. Alerts
# =====================================================================

def raise_alert(store, severity, title, description, station_id, user_id=None, dedupe_key=None):
    """Create an alert. With `dedupe_key`, only one alert per key is kept (updated instead of repeated)."""
    if dedupe_key:
        existing = store.find_one("alerts", dedupeKey=dedupe_key)
        if existing:
            return store.update("alerts", {"id": existing["id"]}, set={"description": description, "timestamp": now_iso()})
    alert = {
        "id": new_id("ALT"), "severity": severity, "title": title, "description": description,
        "timestamp": now_iso(), "stationId": station_id, "userId": user_id, "status": "Unresolved",
        "dedupeKey": dedupe_key,
    }
    store.insert("alerts", alert)
    log.warning("⚠️  Alert [%s] %s - %s", severity, title, description)
    return alert


# =====================================================================
#   9. Analytics (every number on the dashboard comes from here)
# =====================================================================

def _percent_change(current, previous):
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


def analytics(store):
    transactions = store.all("transactions")
    users = store.all("users")
    moment = now()
    today_str = moment.strftime("%Y-%m-%d")
    yesterday_str = (moment - timedelta(days=1)).strftime("%Y-%m-%d")

    def day_of(txn):
        return str(txn.get("timestamp", ""))[:10]

    def liters_on(day):
        return round(sum(float(t.get("waterLiters") or 0) for t in transactions if day_of(t) == day), 2)

    def revenue_between(start, end):   # [start, end) as YYYY-MM-DD strings
        return round(sum(float(t.get("amount") or 0) for t in transactions if start <= day_of(t) < end), 2)

    def days_back(n):
        return (moment - timedelta(days=n)).strftime("%Y-%m-%d")

    tomorrow = days_back(-1)
    revenue_week = revenue_between(days_back(6), tomorrow)
    revenue_last_week = revenue_between(days_back(13), days_back(6))
    today_liters, yesterday_liters = liters_on(today_str), liters_on(yesterday_str)
    new_students = sum(1 for u in users if str(u.get("createdAt", ""))[:10] >= days_back(6))

    # ---- charts ----
    today_chart = []
    for start_hour in range(6, 24, 2):
        bucket = [t for t in transactions if day_of(t) == today_str and start_hour <= _hour(t) < start_hour + 2]
        today_chart.append({
            "time": f"{start_hour:02d}:00", "liters": round(sum(float(t.get("waterLiters") or 0) for t in bucket), 2),
            "users": len({t.get("userId") for t in bucket}),
        })
    week_chart = []
    for n in range(6, -1, -1):
        day = moment - timedelta(days=n)
        key = day.strftime("%Y-%m-%d")
        week_chart.append({"day": day.strftime("%a"), "date": key, "liters": liters_on(key),
                           "revenue": revenue_between(key, days_back(n - 1))})
    month_chart = []
    for week in range(3, -1, -1):
        start, end = days_back(week * 7 + 6), days_back(week * 7 - 1)
        label = f"{(moment - timedelta(days=week * 7 + 6)).strftime('%d %b')} – {(moment - timedelta(days=week * 7)).strftime('%d %b')}"
        month_chart.append({
            "week": label,
            "liters": round(sum(float(t.get("waterLiters") or 0) for t in transactions if start <= day_of(t) < end), 2),
            "revenue": revenue_between(start, end),
        })

    # ---- per hostel (today) ----
    hostels = {}
    for user in users:
        block = user.get("hostelBlock") or "Other"
        hostels.setdefault(block, {"name": block, "studentCount": 0, "waterUsedToday": 0.0, "paymentsToday": 0.0})
        hostels[block]["studentCount"] += 1
    for txn in transactions:
        if day_of(txn) == today_str and txn.get("hostelBlock") in hostels:
            hostels[txn["hostelBlock"]]["waterUsedToday"] = round(hostels[txn["hostelBlock"]]["waterUsedToday"] + float(txn.get("waterLiters") or 0), 2)
            hostels[txn["hostelBlock"]]["paymentsToday"] = round(hostels[txn["hostelBlock"]]["paymentsToday"] + float(txn.get("amount") or 0), 2)

    # ---- per station (today + 7 days) ----
    station_rows = []
    for station in store.all("stations"):
        mine = [t for t in transactions if t.get("stationId") == station["id"]]
        station_rows.append({
            "id": station["id"], "name": station["name"], "isLive": station.get("isLive", False),
            "litersToday": round(sum(float(t.get("waterLiters") or 0) for t in mine if day_of(t) == today_str), 2),
            "litersWeek": round(sum(float(t.get("waterLiters") or 0) for t in mine if day_of(t) >= days_back(6)), 2),
            "transactionsWeek": sum(1 for t in mine if day_of(t) >= days_back(6)),
        })

    # ---- over-usage today (admin dashboard panel) ----
    overuse = []
    for user in users:
        if user.get("status") in ("Suspended", "Inactive"):
            continue
        profile = usage_profile(store, user, transactions)
        used = round(float(user.get("todayUsage") or 0), 2)
        overuse.append({
            "userId": user["id"], "name": user["name"], "hostelBlock": user.get("hostelBlock"),
            "avatar": user.get("avatar"), "todayUsage": used, **profile,
            "percentOfLimit": round(used / profile["limit"] * 100) if profile["limit"] else 0,
            "aboveNormal": used > profile["limit"], "overQuota": used > profile["quota"],
        })
    overuse.sort(key=lambda row: row["percentOfLimit"], reverse=True)

    return {
        "kpis": {
            "dispensedToday": today_liters, "dispensedYesterday": yesterday_liters,
            "dispensedChangePct": _percent_change(today_liters, yesterday_liters),
            "revenueToday": revenue_between(today_str, tomorrow),
            "revenueWeek": revenue_week, "revenueLastWeek": revenue_last_week,
            "revenueChangePct": _percent_change(revenue_week, revenue_last_week),
            "activeStudents": sum(1 for u in users if u.get("status") in ("Active", "Warning")),
            "totalStudents": len(users), "newStudentsWeek": new_students,
            "overUsageToday": sum(1 for row in overuse if row["aboveNormal"] or row["overQuota"]),
        },
        "charts": {"today": today_chart, "thisWeek": week_chart, "thisMonth": month_chart},
        "revenue": [{"label": row["day"], "amount": row["revenue"]} for row in week_chart],
        "hostels": sorted(hostels.values(), key=lambda h: h["name"]),
        "stations": station_rows,
        "overuse": overuse,
    }


def _hour(txn):
    moment = parse_time(txn.get("timestamp"))
    return moment.hour if moment else -1


def user_usage_history(store, user_id, days=7):
    """Litres per day for the last `days` days (oldest first), for the user details chart."""
    transactions = [t for t in store.all("transactions") if t.get("userId") == user_id]
    moment = now()
    history = []
    for n in range(days - 1, -1, -1):
        day = moment - timedelta(days=n)
        key = day.strftime("%Y-%m-%d")
        history.append({
            "day": day.strftime("%a"), "date": key,
            "liters": round(sum(float(t.get("waterLiters") or 0) for t in transactions if str(t.get("timestamp", ""))[:10] == key), 2),
        })
    return history
