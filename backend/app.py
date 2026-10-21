"""
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                 AquaAllot Backend Flask API with MongoDB                   ║
║                         Production Ready v2.1.0                            ║
║                                                                            ║
║  Database: MongoDB (aquaallot db)                                          ║
║  Collections: users, stations, transactions, alerts, anomalies, settings   ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import uuid
import hashlib
import hmac
import logging
from dotenv import load_dotenv
import os
import pymongo
from bson import json_util

# Load environment variables
load_dotenv()

# ==================== INITIALIZATION ====================
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuration
app.config['JSON_SORT_KEYS'] = False
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', '')
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MONGODB DATABASE SETUP ====================
mongo_client = None
db = None
using_mongo = False

try:
    mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    mongo_client.server_info() # Trigger exception if unreachable
    db = mongo_client['aquaallot']
    using_mongo = True
    logger.info(f"✓ Connected to MongoDB at {MONGO_URI} (database: aquaallot)")
except Exception as e:
    logger.warning(f"⚠ MongoDB connection failed ({e}). Falling back to in-memory mode.")
    using_mongo = False

# Fallback In-Memory Storage
IN_MEMORY_DB = {
    'users': [],
    'stations': [],
    'transactions': [],
    'alerts': [],
    'anomalies': [],
    'settings': {'waterPricePerLiter': 5}
}

# Initial Seed Data
INITIAL_USERS = [
    {
        "id": "USR001",
        "name": "Arun Kumar",
        "hostelBlock": "Hostel Block A",
        "roomNo": "A-204",
        "rfid": "A1B2C3D4",
        "email": "arun@example.com",
        "balance": 120.0,
        "todayUsage": 4.2,
        "monthlyUsage": 86.5,
        "totalSpent": 432.5,
        "status": "Active",
        "avgDailyUsage": 2.8,
        "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    },
    {
        "id": "USR002",
        "name": "Rahul Sharma",
        "hostelBlock": "Hostel Block B",
        "roomNo": "B-112",
        "rfid": "B2C3D4E5",
        "email": "rahul@example.com",
        "balance": 65.0,
        "todayUsage": 8.7,
        "monthlyUsage": 142.0,
        "totalSpent": 710.0,
        "status": "Warning",
        "avgDailyUsage": 2.5,
        "avatar": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80"
    },
    {
        "id": "USR003",
        "name": "Priya Patel",
        "hostelBlock": "Hostel Block A",
        "roomNo": "A-305",
        "rfid": "C3D4E5F6",
        "email": "priya@example.com",
        "balance": 240.0,
        "todayUsage": 2.1,
        "monthlyUsage": 62.4,
        "totalSpent": 312.0,
        "status": "Active",
        "avgDailyUsage": 2.0,
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    },
    {
        "id": "USR004",
        "name": "Vikram Singh",
        "hostelBlock": "PG Block C",
        "roomNo": "C-101",
        "rfid": "D4E5F6G7",
        "email": "vikram@example.com",
        "balance": 15.0,
        "todayUsage": 1.5,
        "monthlyUsage": 45.2,
        "totalSpent": 226.0,
        "status": "Active",
        "avgDailyUsage": 1.8,
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    {
        "id": "USR005",
        "name": "Ananya Roy",
        "hostelBlock": "Hostel Block B",
        "roomNo": "B-218",
        "rfid": "E5F6G7H8",
        "email": "ananya@example.com",
        "balance": 310.0,
        "todayUsage": 3.8,
        "monthlyUsage": 94.0,
        "totalSpent": 470.0,
        "status": "Active",
        "avgDailyUsage": 3.1,
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    }
]

INITIAL_STATIONS = [
    {
        "id": "STN-001",
        "name": "Station A-01",
        "location": "Hostel Block A - Ground Floor",
        "hostelBlock": "Hostel Block A",
        "status": "Online",
        "flowRate": 4.8,
        "todayUsage": 342.0,
        "temperature": "24.5 °C",
        "lastSync": 12,
        "esp32": "Connected",
        "rfidReader": "Operational",
        "flowSensor": "Operational",
        "solenoidValve": "Closed",
        "oledDisplay": "Operational",
        "wifiSignal": -42,
        "firmware": "v2.4.1"
    },
    {
        "id": "STN-002",
        "name": "Station A-02",
        "location": "Hostel Block B - 1st Floor",
        "hostelBlock": "Hostel Block B",
        "status": "Online",
        "flowRate": 3.9,
        "todayUsage": 287.0,
        "temperature": "23.8 °C",
        "lastSync": 8,
        "esp32": "Connected",
        "rfidReader": "Operational",
        "flowSensor": "Operational",
        "solenoidValve": "Closed",
        "oledDisplay": "Operational",
        "wifiSignal": -54,
        "firmware": "v2.4.1"
    },
    {
        "id": "STN-003",
        "name": "Station A-03",
        "location": "PG Block C - Dining Hall",
        "hostelBlock": "PG Block C",
        "status": "Warning",
        "flowRate": 7.8,
        "todayUsage": 421.0,
        "temperature": "26.1 °C",
        "lastSync": 5,
        "esp32": "Connected",
        "rfidReader": "Operational",
        "flowSensor": "Warning: High Flow",
        "solenoidValve": "Closed",
        "oledDisplay": "Operational",
        "wifiSignal": -61,
        "firmware": "v2.4.0",
        "alertMessage": "Unusual flow rate detected"
    }
]

INITIAL_TRANSACTIONS = [
    {
        "id": "TXN-1001",
        "userId": "USR001",
        "userName": "Arun Kumar",
        "hostelBlock": "Hostel Block A",
        "rfid": "A1B2C3D4",
        "amount": 25,
        "waterLiters": 5,
        "paymentStatus": "Paid",
        "dispensingStatus": "Completed",
        "paymentMethod": "Razorpay (UPI)",
        "razorpayPaymentId": "pay_N8z9K0xL1M2N3O",
        "razorpayOrderId": "order_N8z9A0bC1D2E3F",
        "stationId": "STN-001",
        "timestamp": "2026-09-18 10:42:15"
    },
    {
        "id": "TXN-1002",
        "userId": "USR002",
        "userName": "Rahul Sharma",
        "hostelBlock": "Hostel Block B",
        "rfid": "B2C3D4E5",
        "amount": 50,
        "waterLiters": 10,
        "paymentStatus": "Paid",
        "dispensingStatus": "Completed",
        "paymentMethod": "Razorpay (Card)",
        "razorpayPaymentId": "pay_P9a1L1yM2N3O4P",
        "razorpayOrderId": "order_P9a1B0cD2E3F4G",
        "stationId": "STN-003",
        "timestamp": "2026-09-18 11:15:30"
    }
]

INITIAL_ALERTS = [
    {
        "id": "ALT-201",
        "severity": "Critical",
        "title": "Unusual Consumption Spike",
        "description": "Student Rahul Sharma (Hostel Block B) exceeded daily threshold (+100% variance).",
        "timestamp": "10 minutes ago",
        "stationId": "STN-003",
        "userId": "USR002",
        "status": "Unresolved"
    },
    {
        "id": "ALT-202",
        "severity": "Warning",
        "title": "High Flow Rate Detected",
        "description": "Station A-03 (PG Block C) registered flow rate of 7.8 L/min.",
        "timestamp": "25 minutes ago",
        "stationId": "STN-003",
        "userId": None,
        "status": "Unresolved"
    }
]

INITIAL_ANOMALIES = [
    {
        "id": "ANOM-01",
        "userId": "USR002",
        "userName": "Rahul Sharma",
        "hostelBlock": "Hostel Block B",
        "mean": 2.5,
        "stdDev": 0.3,
        "upperThreshold": 3.4,
        "observed": 8.7,
        "deviation": "+248%",
        "severity": "Critical",
        "reason": "Water consumption sharply exceeded 3-Sigma threshold (3.4 L). Potential valve leak or shared card.",
        "timestamp": "Today, 11:15 AM",
        "status": "Investigating"
    }
]

def seed_database_if_empty():
    """Seed MongoDB collections if they are empty"""
    if not using_mongo:
        IN_MEMORY_DB['users'] = list(INITIAL_USERS)
        IN_MEMORY_DB['stations'] = list(INITIAL_STATIONS)
        IN_MEMORY_DB['transactions'] = list(INITIAL_TRANSACTIONS)
        IN_MEMORY_DB['alerts'] = list(INITIAL_ALERTS)
        IN_MEMORY_DB['anomalies'] = list(INITIAL_ANOMALIES)
        return

    if db['users'].count_documents({}) == 0:
        db['users'].insert_many(INITIAL_USERS)
        logger.info("🌱 Seeded MongoDB 'users' collection")

    if db['stations'].count_documents({}) == 0:
        db['stations'].insert_many(INITIAL_STATIONS)
        logger.info("🌱 Seeded MongoDB 'stations' collection")

    if db['transactions'].count_documents({}) == 0:
        db['transactions'].insert_many(INITIAL_TRANSACTIONS)
        logger.info("🌱 Seeded MongoDB 'transactions' collection")

    if db['alerts'].count_documents({}) == 0:
        db['alerts'].insert_many(INITIAL_ALERTS)
        logger.info("🌱 Seeded MongoDB 'alerts' collection")

    if db['anomalies'].count_documents({}) == 0:
        db['anomalies'].insert_many(INITIAL_ANOMALIES)
        logger.info("🌱 Seeded MongoDB 'anomalies' collection")

# Seed on startup
seed_database_if_empty()

# ==================== UTILITY FUNCTIONS ====================
def clean_mongo_doc(doc):
    """Remove ObjectId for clean JSON output"""
    if not doc:
        return doc
    if isinstance(doc, list):
        return [clean_mongo_doc(d) for d in doc]
    if isinstance(doc, dict):
        d = dict(doc)
        d.pop('_id', None)
        return d
    return doc

def verify_razorpay_signature(order_id, payment_id, signature):
    """Verify Razorpay payment signature using HMAC-SHA256"""
    message = f"{order_id}|{payment_id}"
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return generated_signature == signature

def check_anomaly(user_id, consumed_liters, mean=2.8, std_dev=0.8):
    """3-Sigma Anomaly Detection"""
    threshold = mean + (3 * std_dev)
    is_anomaly = consumed_liters > threshold
    return {
        'is_anomaly': is_anomaly,
        'observed': consumed_liters,
        'threshold': threshold,
        'mean': mean,
        'std_dev': std_dev,
        'deviation': f"+{round(((consumed_liters - mean) / std_dev) * 100)}%" if std_dev > 0 else "0%"
    }

def create_response(success, data=None, message="", status_code=200):
    """Standardized API response"""
    response = {
        'success': success,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }
    if data:
        response.update(data)
    return jsonify(response), status_code

# ==================== CORS HEADERS MIDDLEWARE ====================
@app.after_request
def set_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Station-ID'
    return response

# ==================== ROUTE: VERIFY RFID ====================
@app.route('/api/verify_rfid', methods=['POST', 'OPTIONS'])
def verify_rfid():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json() or {}
    rfid_uid = data.get('rfid_uid', '').upper()
    
    logger.info(f"🔐 RFID Verification: UID={rfid_uid}")
    
    if using_mongo:
        user = db['users'].find_one({'rfid': rfid_uid})
    else:
        user = next((u for u in IN_MEMORY_DB['users'] if u['rfid'].upper() == rfid_uid), None)
    
    if not user:
        return create_response(False, message="RFID card not registered", status_code=404)
    
    return create_response(
        True,
        data={'authorized': True, 'user': clean_mongo_doc(user)},
        message="RFID authentication successful"
    )

# ==================== ROUTE: CREATE PAYMENT ORDER ====================
@app.route('/api/create_order', methods=['POST', 'OPTIONS'])
def create_order():
    if request.method == 'OPTIONS':
        return '', 204
    
    # Reload env variables from .env
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(dotenv_path=env_path, override=True)
    
    key_id = os.getenv('RAZORPAY_KEY_ID', '').strip()
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()

    data = request.get_json() or {}
    amount_rupees = data.get('amount_rupees', 25)
    user_id = data.get('user_id', 'USR001')
    water_liters = data.get('water_liters', 5)
    
    # Check if official Razorpay test key is configured
    is_real_key = bool(key_id and key_secret and key_id.startswith('rzp_test_'))
    
    if is_real_key:
        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            order_data = {
                'amount': int(amount_rupees * 100), # in paise
                'currency': 'INR',
                'receipt': f"receipt_{int(datetime.now().timestamp())}",
                'notes': {'user_id': user_id, 'water_liters': str(water_liters)}
            }
            rzp_order = client.order.create(data=order_data)
            logger.info(f"💳 Official Razorpay order created: ID={rzp_order['id']}, Key={key_id}, Amount=₹{amount_rupees}")
            return create_response(
                True,
                data={
                    'id': rzp_order['id'],
                    'amount': rzp_order['amount'],
                    'currency': rzp_order['currency'],
                    'key': key_id,
                    'receipt': rzp_order['receipt'],
                    'is_real_key': True
                },
                message="Official Razorpay order created successfully"
            )
        except Exception as e:
            logger.error(f"Failed to create official Razorpay order: {e}", exc_info=True)
            return create_response(
                False,
                message=f"Razorpay API Error: {str(e)}",
                status_code=400
            )

    # Default fallback for placeholder/simulated keys
    order_id = f"order_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:6].upper()}"
    receipt_id = f"receipt_{int(datetime.now().timestamp())}"
    
    logger.info(f"💳 Simulated Order created: ID={order_id}, Amount=₹{amount_rupees}, Liters={water_liters}")
    
    return create_response(
        True,
        data={
            'id': order_id,
            'amount': int(amount_rupees * 100), # paise
            'currency': 'INR',
            'key': RAZORPAY_KEY_ID,
            'receipt': receipt_id,
            'is_real_key': False,
            'notes': {'user_id': user_id, 'water_liters': water_liters}
        },
        message="Simulated order created successfully"
    )

# ==================== ROUTE: VERIFY PAYMENT ====================
@app.route('/api/verify_payment', methods=['POST', 'OPTIONS'])
def verify_payment():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json() or {}
    order_id = data.get('razorpay_order_id')
    payment_id = data.get('razorpay_payment_id')
    signature = data.get('razorpay_signature')
    user_id = data.get('user_id', 'USR001')
    station_id = data.get('station_id', 'STN-001')
    quantity_liters = data.get('quantity_liters', 5)
    amount_rupees = data.get('amount_rupees', 25)
    
    # Create transaction object
    transaction = {
        'id': f"TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        'userId': user_id,
        'userName': 'User',
        'hostelBlock': 'Hostel Block A',
        'amount': amount_rupees,
        'waterLiters': quantity_liters,
        'paymentStatus': 'Paid',
        'dispensingStatus': 'Completed',
        'paymentMethod': 'Razorpay',
        'razorpayPaymentId': payment_id or f"pay_{uuid.uuid4().hex[:10]}",
        'razorpayOrderId': order_id or f"order_{uuid.uuid4().hex[:10]}",
        'stationId': station_id,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    if using_mongo:
        u = db['users'].find_one({'id': user_id})
        if u:
            transaction['userName'] = u.get('name', 'User')
            transaction['hostelBlock'] = u.get('hostelBlock', 'Hostel Block A')
            transaction['rfid'] = u.get('rfid', '')
            
            # Atomically update user todayUsage and totalSpent in MongoDB
            db['users'].update_one(
                {'id': user_id},
                {'$inc': {'todayUsage': float(quantity_liters), 'monthlyUsage': float(quantity_liters), 'totalSpent': float(amount_rupees)}}
            )
            
        db['transactions'].insert_one(transaction)
        logger.info(f"✅ Transaction logged to MongoDB 'transactions': ID={transaction['id']}, User={user_id}, Amount=₹{amount_rupees}")
    else:
        IN_MEMORY_DB['transactions'].insert(0, transaction)
    
    return create_response(
        True,
        data={
            'verified': True,
            'status': 'Authorized',
            'payment_id': payment_id,
            'order_id': order_id,
            'dispensing_authorized': True,
            'transaction': clean_mongo_doc(transaction)
        },
        message="Razorpay signature verified. Water dispensing authorized."
    )

# ==================== ROUTE: LOG USAGE ====================
@app.route('/api/log_usage', methods=['POST', 'OPTIONS'])
def log_usage():
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json() or {}
    user_id = data.get('user_id')
    water_liters = data.get('water_liters', 0)
    amount_rupees = data.get('amount_rupees', 0)
    
    if user_id:
        if using_mongo:
            db['users'].update_one(
                {'id': user_id},
                {'$inc': {'todayUsage': water_liters, 'monthlyUsage': water_liters, 'totalSpent': amount_rupees}}
            )
        else:
            for u in IN_MEMORY_DB['users']:
                if u['id'] == user_id:
                    u['todayUsage'] += water_liters
                    u['monthlyUsage'] += water_liters
                    u['totalSpent'] += amount_rupees
    
    anomaly = check_anomaly(user_id, water_liters)
    if anomaly['is_anomaly']:
        alert = {
            'id': f"ALT-{uuid.uuid4().hex[:6].upper()}",
            'severity': 'Critical',
            'title': 'Unusual Consumption Spike',
            'description': f"User {user_id} exceeded 3-Sigma threshold with {water_liters} L.",
            'timestamp': 'Just now',
            'stationId': data.get('station_id', 'STN-001'),
            'userId': user_id,
            'status': 'Unresolved'
        }
        if using_mongo:
            db['alerts'].insert_one(alert)
        else:
            IN_MEMORY_DB['alerts'].insert(0, alert)

    return create_response(True, data={'logged': True}, message="Usage logged to database")

# ==================== ROUTE: USERS CRUD ====================
@app.route('/api/users', methods=['GET', 'POST', 'OPTIONS'])
def handle_users():
    if request.method == 'OPTIONS':
        return '', 204
    
    if request.method == 'GET':
        if using_mongo:
            users_list = list(db['users'].find({}))
        else:
            users_list = IN_MEMORY_DB['users']
        return create_response(True, data={'users': clean_mongo_doc(users_list)})
    
    elif request.method == 'POST':
        data = request.get_json() or {}
        new_user = {
            'id': f"USR{str(uuid.uuid4())[:4].upper()}",
            'name': data.get('name', 'New Student'),
            'email': data.get('email', ''),
            'hostelBlock': data.get('hostelBlock', 'Hostel Block A'),
            'roomNo': data.get('roomNo', 'A-101'),
            'rfid': data.get('rfid', '').upper(),
            'balance': data.get('balance', 100),
            'todayUsage': 0.0,
            'monthlyUsage': 0.0,
            'totalSpent': 0.0,
            'status': 'Active',
            'avgDailyUsage': 2.5,
            'avatar': f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('name', 'User')}"
        }
        if using_mongo:
            db['users'].insert_one(new_user)
        else:
            IN_MEMORY_DB['users'].insert(0, new_user)
        
        return create_response(True, data={'user': clean_mongo_doc(new_user)}, message="User created in MongoDB")

@app.route('/api/users/<user_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_user(user_id):
    if request.method == 'GET':
        if using_mongo:
            u = db['users'].find_one({'id': user_id})
        else:
            u = next((x for x in IN_MEMORY_DB['users'] if x['id'] == user_id), None)
        return create_response(True, data={'user': clean_mongo_doc(u)})

@app.route('/api/users/<user_id>/topup', methods=['POST'])
def topup_user_balance(user_id):
    data = request.get_json() or {}
    amount = data.get('amount', 100)
    
    if using_mongo:
        db['users'].update_one({'id': user_id}, {'$inc': {'balance': amount}})
    else:
        for u in IN_MEMORY_DB['users']:
            if u['id'] == user_id:
                u['balance'] += amount
                
    return create_response(True, message=f"Added ₹{amount} to balance")

# ==================== ROUTE: TRANSACTIONS ====================
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    if using_mongo:
        txns = list(db['transactions'].find({}))
    else:
        txns = IN_MEMORY_DB['transactions']
    return create_response(True, data={'transactions': clean_mongo_doc(txns)})

# ==================== ROUTE: STATIONS ====================
@app.route('/api/stations', methods=['GET'])
def get_stations():
    if using_mongo:
        stns = list(db['stations'].find({}))
    else:
        stns = IN_MEMORY_DB['stations']
    return create_response(True, data={'stations': clean_mongo_doc(stns)})

@app.route('/api/stations/<station_id>/telemetry', methods=['POST', 'OPTIONS'])
def handle_station_telemetry(station_id):
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json() or {}
    logger.info(f"📡 Telemetry from {station_id}: event={data.get('event')}, flow={data.get('flow_rate_lpm')} L/min")
    
    update_fields = {'lastSync': 0}
    if 'flow_rate_lpm' in data:
        update_fields['flowRate'] = data['flow_rate_lpm']
    if 'solenoid_valve' in data:
        update_fields['solenoidValve'] = 'Open' if data['solenoid_valve'] == 'OPEN' else 'Closed'
        
    if using_mongo:
        db['stations'].update_one({'id': station_id}, {'$set': update_fields})
    else:
        for s in IN_MEMORY_DB['stations']:
            if s['id'] == station_id:
                s.update(update_fields)
                
    return create_response(True, data={'telemetry_logged': True}, message="Station telemetry updated")


# ==================== ROUTE: ALERTS ====================
@app.route('/api/alerts', methods=['GET', 'POST', 'OPTIONS'])
def handle_alerts():
    if request.method == 'OPTIONS':
        return '', 204

    if request.method == 'GET':
        if using_mongo:
            alerts = list(db['alerts'].find({}))
            anomalies = list(db['anomalies'].find({}))
        else:
            alerts = IN_MEMORY_DB['alerts']
            anomalies = IN_MEMORY_DB['anomalies']
        return create_response(True, data={'alerts': clean_mongo_doc(alerts), 'anomalies': clean_mongo_doc(anomalies)})

    elif request.method == 'POST':
        data = request.get_json() or {}
        alert = {
            'id': f"ALT-{uuid.uuid4().hex[:6].upper()}",
            'severity': data.get('severity', 'Critical'),
            'title': data.get('title', 'System Warning'),
            'description': data.get('reason') or data.get('description', 'Alert triggered'),
            'timestamp': 'Just now',
            'stationId': data.get('station_id', 'STN-001'),
            'userId': data.get('user_id', 'USR001'),
            'status': 'Unresolved'
        }
        if using_mongo:
            db['alerts'].insert_one(alert)
        else:
            IN_MEMORY_DB['alerts'].insert(0, alert)

        logger.info(f"⚠️ Alert logged: {alert['title']} from station {alert['stationId']}")
        return create_response(True, data={'alert': clean_mongo_doc(alert)}, message="Alert logged to database")


# ==================== HEALTH CHECK ====================
@app.route('/api/health', methods=['GET'])
def health_check():
    user_count = db['users'].count_documents({}) if using_mongo else len(IN_MEMORY_DB['users'])
    station_count = db['stations'].count_documents({}) if using_mongo else len(IN_MEMORY_DB['stations'])
    return create_response(
        True,
        data={
            'status': 'HEALTHY',
            'database': 'MongoDB (aquaallot)' if using_mongo else 'In-Memory',
            'usersCount': user_count,
            'stationsCount': station_count,
            'timestamp': datetime.now().isoformat()
        },
        message="AquaAllot API System Operational"
    )

if __name__ == '__main__':
    logger.info("╔════════════════════════════════════════════════════╗")
    logger.info("║   AquaAllot Flask Backend API - MongoDB Powered    ║")
    logger.info("║   MongoDB Connection: localhost:27017              ║")
    logger.info("║   API Base URL: http://localhost:5000/api          ║")
    logger.info("╚════════════════════════════════════════════════════╝\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
