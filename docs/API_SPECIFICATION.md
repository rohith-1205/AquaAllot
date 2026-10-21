# AquaAllot Review 2 - Complete API Specification

## Base URL
```
http://localhost:5000/api
```

## HTTP Headers Required
```
Content-Type: application/json
X-Station-ID: STN-001
```

---

## 🔐 RFID Verification

### POST /verify_rfid
Authenticate user using RFID card UID.

**Request:**
```json
{
  "rfid_uid": "A1B2C3D4",
  "station_id": "STN-001"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "authorized": true,
  "user": {
    "id": "USR001",
    "name": "Arun Kumar",
    "hostelBlock": "Hostel Block A",
    "roomNo": "A-204",
    "rfid": "A1B2C3D4",
    "email": "arun@example.com",
    "balance": 250.5,
    "todayUsage": 4.2,
    "monthlyUsage": 86.5,
    "totalSpent": 432.5,
    "status": "Active",
    "avgDailyUsage": 2.8
  },
  "message": "RFID authentication successful"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/verify_rfid \
  -H "Content-Type: application/json" \
  -d '{"rfid_uid": "A1B2C3D4", "station_id": "STN-001"}'
```

---

## 💳 Payment Integration

### POST /create_order
Create Razorpay payment order.

**Request:**
```json
{
  "amount_rupees": 25,
  "user_id": "USR001",
  "water_liters": 5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "id": "order_20260918143022",
  "amount": 2500,
  "currency": "INR",
  "receipt": "receipt_1726650022000",
  "notes": {
    "user_id": "USR001",
    "water_liters": 5
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/create_order \
  -H "Content-Type: application/json" \
  -d '{
    "amount_rupees": 25,
    "user_id": "USR001",
    "water_liters": 5
  }'
```

---

### POST /verify_payment
Verify Razorpay payment using HMAC-SHA256 signature.

**Request:**
```json
{
  "razorpay_order_id": "order_20260918143022",
  "razorpay_payment_id": "pay_Ir9wgHHDvxAHfZ",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d",
  "user_id": "USR001",
  "station_id": "STN-001",
  "quantity_liters": 5,
  "amount_rupees": 25
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "verified": true,
  "status": "Authorized",
  "payment_id": "pay_Ir9wgHHDvxAHfZ",
  "order_id": "order_20260918143022",
  "dispensing_authorized": true,
  "message": "Razorpay signature verified successfully. Water dispensing authorized."
}
```

**Security Note:**
- HMAC-SHA256 verification happens on backend only
- Secret key never exposed to frontend
- Prevents payment fraud & signature spoofing

---

## 📝 Usage Logging

### POST /log_usage
Log water dispensing transaction and usage data.

**Request:**
```json
{
  "transaction_id": "TXN-20260918143022-A1B2C3D4",
  "user_id": "USR001",
  "station_id": "STN-001",
  "water_liters": 4.96,
  "amount_rupees": 25,
  "pulse_count": 2232,
  "flow_rate_lpm": 4.8,
  "status": "Completed"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "logged": true,
  "transaction_id": "TXN-20260918143022-A1B2C3D4",
  "anomaly_detected": false,
  "message": "Water usage and telemetry logged to database"
}
```

**Anomaly Response (Anomaly Detected):**
```json
{
  "success": true,
  "logged": true,
  "anomaly_detected": true,
  "anomaly_details": {
    "is_anomaly": true,
    "observed": 8.7,
    "threshold": 5.2,
    "mean": 2.8,
    "std_dev": 0.8,
    "deviation": 7.375
  }
}
```

---

## 📊 Data Retrieval

### GET /users
Retrieve all registered users.

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "USR001",
      "name": "Arun Kumar",
      "hostelBlock": "Hostel Block A",
      "roomNo": "A-204",
      "rfid": "A1B2C3D4",
      "balance": 250.5,
      "status": "Active"
    }
  ]
}
```

---

### GET /transactions
Retrieve transaction history.

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "TXN-20260918140000-ABC12345",
      "userId": "USR001",
      "userName": "Arun Kumar",
      "hostelBlock": "Hostel Block A",
      "amount": 25,
      "waterLiters": 4.96,
      "paymentStatus": "SUCCESS",
      "dispensingStatus": "COMPLETED",
      "stationId": "STN-001",
      "timestamp": "2026-09-18T14:00:00"
    }
  ]
}
```

---

### GET /water-usage
Get water usage analytics.

**Response:**
```json
{
  "success": true,
  "usage": {
    "today": [
      {"time": "08:00", "liters": 45, "users": 8},
      {"time": "09:00", "liters": 78, "users": 12},
      {"time": "10:00", "liters": 120, "users": 18}
    ],
    "thisWeek": [...],
    "thisMonth": [...]
  }
}
```

---

### GET /alerts
Get active alerts and anomalies.

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "ALERT-001",
      "severity": "Critical",
      "title": "Unusual Consumption Spike",
      "description": "User USR002 exceeded 3-Sigma daily limit",
      "timestamp": "2026-09-18T14:05:30",
      "stationId": "STN-003",
      "userId": "USR002",
      "status": "Unresolved"
    }
  ],
  "anomalies": [...]
}
```

---

### GET /stations
Get all station status information.

**Response:**
```json
{
  "success": true,
  "stations": [
    {
      "id": "STN-001",
      "name": "Main Dispensing Point",
      "location": "Hostel Block A - Ground Floor",
      "status": "ONLINE",
      "flowRate": 4.8,
      "todayUsage": 245.5,
      "temperature": 24.5,
      "lastSync": "2026-09-18T14:05:00",
      "esp32": "ESP32-001",
      "rfidReader": "MFRC522-001",
      "flowSensor": "YF-S201-001",
      "solenoidValve": "CLOSED",
      "wifiSignal": -42,
      "firmware": "v2.0.1"
    }
  ]
}
```

---

## 🔌 ESP32 Telemetry

### POST /stations/{station_id}/telemetry
Log real-time telemetry from ESP32.

**Event: Dispensing Started**
```json
{
  "event": "dispensing_started",
  "station_id": "STN-001",
  "user_id": "USR001",
  "order_id": "order_xyz",
  "target_liters": 5.0,
  "solenoid_valve": "OPEN",
  "timestamp": "2026-09-18T09:17:51Z"
}
```

**Event: Live Flow Telemetry**
```json
{
  "event": "live_flow_telemetry",
  "station_id": "STN-001",
  "flow_rate_lpm": 4.8,
  "sensor_pulse_count": 1125,
  "wifi_rssi_dbm": -42,
  "temperature_c": 24.5
}
```

**Event: Quantity Update**
```json
{
  "event": "quantity_update",
  "station_id": "STN-001",
  "dispensed_liters": 2.5,
  "target_liters": 5.0,
  "progress_percent": 50
}
```

**Event: Dispensing Completed**
```json
{
  "event": "dispensing_completed",
  "transaction_id": "TXN-1001",
  "user_id": "USR001",
  "station_id": "STN-001",
  "water_liters": 4.96,
  "amount_rupees": 25,
  "solenoid_valve": "CLOSED",
  "measurement_accuracy_pct": 99.2,
  "status": "Completed"
}
```

**Event: Anomaly Detected**
```json
{
  "event": "anomaly_detected",
  "station_id": "STN-003",
  "user_id": "USR002",
  "severity": "Critical",
  "title": "Unusual Consumption Spike",
  "observed_liters": 8.7,
  "upper_threshold_liters": 5.2,
  "reason": "Water consumption sharply exceeded 3-Sigma threshold"
}
```

**Event: Emergency Valve Shutdown**
```json
{
  "event": "valve_shutdown",
  "station_id": "STN-003",
  "solenoid_valve": "FORCE_CLOSED",
  "trigger_source": "YF-S201 Safety Interlock",
  "flow_rate_lpm": 7.8,
  "reason": "High flow rate surge anomaly triggered emergency valve shutdown"
}
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameters",
  "timestamp": "2026-09-18T14:00:00"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid payment signature",
  "timestamp": "2026-09-18T14:00:00"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "RFID card not registered",
  "timestamp": "2026-09-18T14:00:00"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "timestamp": "2026-09-18T14:00:00"
}
```

---

## 🔄 Complete Flow Diagram

```
User Action → RFID Scan
     ↓
Verify RFID (/verify_rfid)
     ↓ (if valid)
Display User Info → Select Amount
     ↓
Create Order (/create_order)
     ↓
Razorpay Payment Modal
     ↓ (if paid)
Verify Payment (/verify_payment)
     ↓ (if valid signature)
ESP32 Opens Valve
     ↓
Monitor Flow (Real-time updates)
     ↓
Target Reached → Close Valve
     ↓
Log Usage (/log_usage)
     ↓
Check Anomalies → Update Dashboard
     ↓
Store Transaction
```

---

## 📌 Important Notes

1. **HMAC-SHA256 Verification**
   - Message format: `{order_id}|{payment_id}`
   - Secret key stored securely on backend
   - Prevents tampering & fraudulent payments

2. **3-Sigma Anomaly Detection**
   - Formula: μ + 3σ = 2.8 + 3(0.8) = 5.2L
   - Automatically triggers alert & stops dispensing
   - Configurable threshold per user

3. **Rate Limiting**
   - 100 requests per minute per IP
   - Prevents abuse & DDoS attacks

4. **Data Retention**
   - Transactions: Permanent
   - Alerts: 90 days
   - Telemetry: 7 days

---

**Last Updated**: September 2026
**Version**: 2.0.1 API
**Status**: ✅ Production Ready
