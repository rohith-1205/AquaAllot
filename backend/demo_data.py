"""
demo_data.py - the sample data the backend starts with.

The RFID cards match the cards built into the Wokwi MFRC522 part, so every
card you tap in the simulator does something useful in the demo:

    Wokwi card     UID                    Who / what it shows
    ------------   --------------------   -----------------------------------------
    Blue card      01:02:03:04            Rohith       - happy path, wallet has money
    Green card     11:22:33:44            Deepankishor - low wallet, must pay by Razorpay
    Yellow card    55:66:77:88            Sanjay       - low daily average, 5 L = AI anomaly
    Key fob        C0:FF:EE:99            Karthik      - suspended account, access denied
    Red card       AA:BB:CC:DD            (not registered)  -> "Unknown card"
    NFC tag        04:11:22:33:44:55:66   (not registered)  -> register it live from Users page

Change these values to change the demo. Restart the backend (or use
Settings -> "Reset demo data") to load them again.
"""

from datetime import datetime, timedelta

# Bump this number whenever the demo data changes, so an old MongoDB
# database gets re-seeded automatically on the next start.
SEED_VERSION = 3

WATER_PRICE_PER_LITER = 5          # ₹ per litre
WIRED_STATION_ID = "STN-001"        # the station that the Wokwi ESP32 drives


def avatar(seed):
    return f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}"


def make_users():
    return [
        {
            "id": "USR001", "name": "Rohith", "email": "rohith@aquaallot.demo",
            "hostelBlock": "Hostel Block A", "roomNo": "A-204",
            "rfid": "01:02:03:04", "rfidCard": "Wokwi Blue card",
            "balance": 150.0, "todayUsage": 0.0, "monthlyUsage": 64.5, "totalSpent": 322.5,
            "avgDailyUsage": 3.0, "usageStdDev": 0.8, "status": "Active", "avatar": avatar("Rohith"),
        },
        {
            "id": "USR002", "name": "Deepankishor", "email": "deepankishor@aquaallot.demo",
            "hostelBlock": "Hostel Block B", "roomNo": "B-112",
            "rfid": "11:22:33:44", "rfidCard": "Wokwi Green card",
            "balance": 8.0, "todayUsage": 0.0, "monthlyUsage": 58.0, "totalSpent": 290.0,
            "avgDailyUsage": 2.6, "usageStdDev": 0.7, "status": "Active", "avatar": avatar("Deepankishor"),
        },
        {
            "id": "USR003", "name": "Sanjay", "email": "sanjay@aquaallot.demo",
            "hostelBlock": "Hostel Block A", "roomNo": "A-305",
            "rfid": "55:66:77:88", "rfidCard": "Wokwi Yellow card",
            "balance": 200.0, "todayUsage": 0.0, "monthlyUsage": 41.0, "totalSpent": 205.0,
            "avgDailyUsage": 1.5, "usageStdDev": 0.5, "status": "Active", "avatar": avatar("Sanjay"),
        },
        {
            "id": "USR004", "name": "Karthik N", "email": "karthik@aquaallot.demo",
            "hostelBlock": "PG Block C", "roomNo": "C-302",
            "rfid": "C0:FF:EE:99", "rfidCard": "Wokwi Key fob",
            "balance": 0.0, "todayUsage": 0.0, "monthlyUsage": 38.0, "totalSpent": 190.0,
            "avgDailyUsage": 1.5, "usageStdDev": 0.5, "status": "Suspended", "avatar": avatar("Karthik"),
        },
        # Background users (cards that are not in the Wokwi simulator)
        {
            "id": "USR005", "name": "Priya Patel", "email": "priya@aquaallot.demo",
            "hostelBlock": "Hostel Block A", "roomNo": "A-118",
            "rfid": "DE:AD:BE:EF", "rfidCard": "Physical card",
            "balance": 240.0, "todayUsage": 2.0, "monthlyUsage": 62.4, "totalSpent": 312.0,
            "avgDailyUsage": 2.0, "usageStdDev": 0.6, "status": "Active", "avatar": avatar("Priya"),
        },
        {
            "id": "USR006", "name": "Ananya Roy", "email": "ananya@aquaallot.demo",
            "hostelBlock": "Hostel Block B", "roomNo": "B-218",
            "rfid": "CA:FE:BA:BE", "rfidCard": "Physical card",
            "balance": 310.0, "todayUsage": 3.0, "monthlyUsage": 94.0, "totalSpent": 470.0,
            "avgDailyUsage": 3.1, "usageStdDev": 0.9, "status": "Active", "avatar": avatar("Ananya"),
        },
    ]


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
            "isLive": False,
            "status": "Online", "esp32": "Connected", "solenoidValve": "Closed",
            "flowRate": 3.9, "todayUsage": 287.0, "temperature": "23.8 °C", "lastSync": 8,
            "wifiSignal": -54, "firmware": "v3.0.0",
        },
        {
            **common,
            "id": "STN-003", "name": "Station C-01 (sample)",
            "location": "PG Block C - Dining Hall", "hostelBlock": "PG Block C",
            "isLive": False,
            "status": "Warning", "esp32": "Connected", "solenoidValve": "Closed",
            "flowSensor": "Warning: High Flow", "alertMessage": "Unusual flow rate detected",
            "flowRate": 7.8, "todayUsage": 421.0, "temperature": "26.1 °C", "lastSync": 5,
            "wifiSignal": -61, "firmware": "v3.0.0",
        },
    ]


def make_transactions():
    """A small history so the tables and charts are not empty. Newest first."""
    now = datetime.now()
    history = [
        # (hours ago, user id, name, block, card, litres, method, station)
        (1, "USR001", "Rohith", "Hostel Block A", "01:02:03:04", 2, "Wallet", WIRED_STATION_ID),
        (3, "USR005", "Priya Patel", "Hostel Block A", "DE:AD:BE:EF", 2, "Razorpay (UPI)", "STN-002"),
        (5, "USR006", "Ananya Roy", "Hostel Block B", "CA:FE:BA:BE", 1, "Razorpay (Card)", "STN-003"),
        (20, "USR002", "Deepankishor", "Hostel Block B", "11:22:33:44", 5, "Razorpay (UPI)", WIRED_STATION_ID),
        (26, "USR003", "Sanjay", "Hostel Block A", "55:66:77:88", 1, "Wallet", WIRED_STATION_ID),
        (30, "USR006", "Ananya Roy", "Hostel Block B", "CA:FE:BA:BE", 2, "Wallet", "STN-002"),
    ]
    transactions = []
    for index, (hours_ago, user_id, name, block, card, liters, method, station) in enumerate(history):
        transactions.append({
            "id": f"TXN-{1006 - index}",
            "userId": user_id, "userName": name, "hostelBlock": block, "rfid": card,
            "amount": liters * WATER_PRICE_PER_LITER, "waterLiters": liters,
            "paymentStatus": "Paid", "dispensingStatus": "Completed", "paymentMethod": method,
            "razorpayPaymentId": None, "razorpayOrderId": None,
            "stationId": station,
            "timestamp": (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return transactions


def make_alerts():
    return [
        {
            "id": "ALT-201", "severity": "Warning", "title": "High Flow Rate Detected (sample)",
            "description": "Station C-01 registered a flow rate of 7.8 L/min.",
            "timestamp": "25 minutes ago", "stationId": "STN-003", "userId": None, "status": "Unresolved",
        }
    ]


def make_anomalies():
    return []


def make_settings():
    return [{"id": "global", "waterPricePerLiter": WATER_PRICE_PER_LITER}]
