"""
demo_data.py - the sample data the backend starts with.

The RFID cards match the cards built into the Wokwi MFRC522 part, so every
card you tap in the simulator does something useful in the demo:

    Wokwi card     UID                    Who / what it shows
    ------------   --------------------   -----------------------------------------
    Blue card      01:02:03:04            Rohith       - normal purchase, pay with Razorpay
    Green card     11:22:33:44            Deepankishor - press PAY in Wokwi → Razorpay opens on the dashboard
    Yellow card    55:66:77:88            Sanjay       - low daily average, 5 L = over-usage alert
    Key fob        C0:FF:EE:99            Karthik      - suspended account, access denied
    Red card       AA:BB:CC:DD            (not registered)  -> "Unknown card"
    NFC tag        04:11:22:33:44:55:66   (not registered)  -> register it live from Users page

A 30-day purchase history is generated for every student (same numbers on
every start), so the charts and the usage baselines come from real stored
transactions instead of hard-coded chart values.

Change these values to change the demo. Restart the backend (or use
Settings -> "Reset demo data") to load them again.
"""

import random
from datetime import datetime, timedelta

# Bump this number whenever the demo data changes, so an old MongoDB
# database gets re-seeded automatically on the next start.
SEED_VERSION = 5

WATER_PRICE_PER_LITER = 5          # ₹ per litre
DAILY_QUOTA_LITERS = 10            # normal allotment per student per day
WIRED_STATION_ID = "STN-001"        # the station that the Wokwi ESP32 drives
HISTORY_DAYS = 30


def iso(moment):
    """All timestamps are stored like 2026-10-21T18:24:05 (ISO 8601)."""
    return moment.replace(microsecond=0).isoformat()


def avatar(seed):
    return f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}"


# (id, name, email-name, block, room, card, card label, normal L/day, spread, status, home station)
STUDENTS = [
    ("USR001", "Rohith", "rohith", "Hostel Block A", "A-204", "01:02:03:04", "Wokwi Blue card", 3.0, 0.8, "Active", WIRED_STATION_ID),
    ("USR002", "Deepankishor", "deepankishor", "Hostel Block B", "B-112", "11:22:33:44", "Wokwi Green card", 2.6, 0.7, "Active", WIRED_STATION_ID),
    ("USR003", "Sanjay", "sanjay", "Hostel Block A", "A-305", "55:66:77:88", "Wokwi Yellow card", 1.5, 0.5, "Active", WIRED_STATION_ID),
    ("USR004", "Karthik N", "karthik", "PG Block C", "C-302", "C0:FF:EE:99", "Wokwi Key fob", 1.5, 0.5, "Suspended", "STN-003"),
    ("USR005", "Priya Patel", "priya", "Hostel Block A", "A-118", "DE:AD:BE:EF", "Physical card", 2.0, 0.6, "Active", "STN-002"),
    ("USR006", "Ananya Roy", "ananya", "Hostel Block B", "B-218", "CA:FE:BA:BE", "Physical card", 3.1, 0.9, "Active", "STN-002"),
]


def make_users():
    users = []
    for (uid, name, mail, block, room, card, label, mean, spread, status, _) in STUDENTS:
        users.append({
            "id": uid, "name": name, "email": f"{mail}@aquaallot.demo",
            "hostelBlock": block, "roomNo": room, "rfid": card, "rfidCard": label,
            "todayUsage": 0.0, "monthlyUsage": 0.0, "totalSpent": 0.0,
            # Starting values for the over-usage check. Once a student has enough history,
            # the backend learns the real average / spread from their transactions.
            "avgDailyUsage": mean, "usageStdDev": spread,
            "dailyQuota": DAILY_QUOTA_LITERS, "status": status, "avatar": avatar(name.split()[0]),
            "createdAt": iso(datetime.now() - timedelta(days=HISTORY_DAYS + 10)),
        })
    _add_history_totals(users)
    return users


def make_transactions():
    """30 days of purchases (newest first), one or two per student per day, around their normal usage."""
    rng = random.Random(42)  # same "random" history on every start
    now = datetime.now()
    transactions = []
    counter = 5000
    for days_ago in range(HISTORY_DAYS, 0, -1):          # history stops yesterday: today starts clean
        day = now - timedelta(days=days_ago)
        for (uid, name, _, block, _, card, _, mean, spread, status, station) in STUDENTS:
            if status != "Active" and days_ago < 12:      # suspended students stopped buying
                continue
            liters = max(0.5, round(rng.gauss(mean, spread) * 2) / 2)   # nearest 0.5 L
            parts = [liters] if liters <= 2.5 else [round(liters / 2, 1), round(liters - round(liters / 2, 1), 1)]
            for part in parts:
                counter += 1
                moment = day.replace(hour=rng.choice([7, 8, 9, 12, 13, 17, 18, 19, 20, 21]), minute=rng.randint(0, 59), second=0)
                transactions.append({
                    "id": f"TXN-{counter}", "userId": uid, "userName": name, "hostelBlock": block, "rfid": card,
                    "amount": round(part * WATER_PRICE_PER_LITER, 2), "waterLiters": part,
                    "paymentStatus": "Paid", "dispensingStatus": "Completed",
                    "paymentMethod": rng.choice(["Razorpay (UPI)", "Razorpay (Card)"]), "razorpayPaymentId": None,
                    "orderId": None, "stationId": station, "timestamp": iso(moment),
                })
    transactions.sort(key=lambda t: t["timestamp"], reverse=True)
    return transactions


def _add_history_totals(users):
    """Fill monthlyUsage / totalSpent from the generated history so the numbers agree."""
    history = make_transactions()
    month = datetime.now().strftime("%Y-%m")
    for user in users:
        mine = [t for t in history if t["userId"] == user["id"]]
        user["totalSpent"] = round(sum(t["amount"] for t in mine), 2)
        user["monthlyUsage"] = round(sum(t["waterLiters"] for t in mine if t["timestamp"].startswith(month)), 2)


def make_stations():
    common = {"rfidReader": "Operational", "flowSensor": "Operational", "oledDisplay": "Operational"}
    return [
        {
            **common,
            "id": WIRED_STATION_ID, "name": "Wokwi ESP32 Station",
            "location": "Hostel Block A - Ground Floor", "hostelBlock": "Hostel Block A",
            "isLive": True,  # real data from the Wokwi simulation
            "status": "Offline", "esp32": "Waiting for Wokwi", "solenoidValve": "Closed",
            "flowRate": 0.0, "todayUsage": 0.0, "temperature": "-", "lastSync": None,
            "wifiSignal": None, "firmware": "-",
        },
        {
            **common,
            "id": "STN-002", "name": "Station B-01 (sample)",
            "location": "Hostel Block B - 1st Floor", "hostelBlock": "Hostel Block B",
            "isLive": False,  # no device: shown as "Sample" and not counted as online
            "status": "Sample", "esp32": "Not connected (sample)", "solenoidValve": "Closed",
            "flowRate": 0.0, "todayUsage": 0.0, "temperature": "-", "lastSync": None,
            "wifiSignal": None, "firmware": "-",
        },
        {
            **common,
            "id": "STN-003", "name": "Station C-01 (sample)",
            "location": "PG Block C - Dining Hall", "hostelBlock": "PG Block C",
            "isLive": False,
            "status": "Sample", "esp32": "Not connected (sample)", "solenoidValve": "Closed",
            "flowRate": 0.0, "todayUsage": 0.0, "temperature": "-", "lastSync": None,
            "wifiSignal": None, "firmware": "-",
        },
    ]


def make_alerts():
    return []


def make_anomalies():
    return []


def make_settings():
    return [{
        "id": "global",
        "waterPricePerLiter": WATER_PRICE_PER_LITER,
        "dailyQuotaLiters": DAILY_QUOTA_LITERS,
        "usageDate": datetime.now().strftime("%Y-%m-%d"),   # day that todayUsage belongs to
    }]
