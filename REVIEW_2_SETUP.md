# AquaAllot Review 2 - Complete Setup & Integration Guide

## 📋 Project Overview

AquaAllot is an **RFID-based Intelligent Water Allocation & Smart Dispensing System** featuring:

- ✅ **RFID Authentication** (MFRC522) - Secure user identification
- ✅ **Payment Gateway** (Razorpay) - Prepaid water dispensing
- ✅ **IoT Monitoring** (ESP32 + Flow Sensor) - Real-time usage tracking
- ✅ **Anomaly Detection** (3-Sigma Statistical Analysis) - Leak detection
- ✅ **Live Dashboard** (React + Charts) - Real-time analytics
- ✅ **Backend API** (Flask) - Complete data management
- ✅ **Wokwi Simulation** - Full hardware testing environment

---

## 🚀 Quick Start (5 Minutes)

### 1. **Install Python Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

### 2. **Start Flask Backend**
```bash
python app.py
```
Backend will run on: `http://localhost:5000/api`

### 3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### 4. **Start React Dashboard**
```bash
npm run dev
```
Dashboard will run on: `http://localhost:5173`

### 5. **Access Wokwi Simulation**
- Open `esp32-wokwi/diagram.json` in [Wokwi Editor](https://wokwi.com)
- Upload `esp32-wokwi/sketch.ino`
- Start simulation and monitor in real-time

---

## 📁 Project Structure

```
AquaAllot-Review2/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx          ✨ Main dashboard with metrics
│   │   │   └── PaymentGateway.jsx     💳 RFID + Payment integration
│   │   ├── styles/
│   │   │   ├── Dashboard.css          🎨 Vibrant dashboard styling
│   │   │   └── PaymentGateway.css     💎 Payment UI styling
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app.py                         🔗 Flask API server
│   ├── requirements.txt
│   └── .env                           ⚙️ Configuration
│
├── esp32-wokwi/
│   ├── diagram.json                   🔌 Hardware diagram
│   └── sketch.ino   📲 ESP32 code
│
├── docs/
│   ├── API_SPECIFICATION.md
│   ├── SYSTEM_ARCHITECTURE.md
│   └── TESTING_GUIDE.md
│
└── REVIEW_2_SETUP.md                  📖 This file
```

---

## 🔐 API Endpoints Reference

### Authentication & RFID
```
POST /api/verify_rfid
├─ Request: { "rfid_uid": "A1B2C3D4", "station_id": "STN-001" }
└─ Response: { "authorized": true, "user": {...} }
```

### Payment Processing
```
POST /api/create_order
├─ Request: { "amount_rupees": 25, "user_id": "USR001", "water_liters": 5 }
└─ Response: { "id": "order_xyz", "amount": 2500, "currency": "INR" }

POST /api/verify_payment
├─ Request: { "razorpay_order_id": "...", "razorpay_payment_id": "...", ... }
└─ Response: { "verified": true, "dispensing_authorized": true }
```

### Usage Logging
```
POST /api/log_usage
├─ Request: { "transaction_id": "TXN-1001", "water_liters": 4.96, ... }
└─ Response: { "logged": true, "anomaly_detected": false }
```

### Real-time Data
```
GET /api/users              ← Get all users
GET /api/stations           ← Get station status
GET /api/transactions       ← Transaction history
GET /api/water-usage        ← Usage analytics
GET /api/alerts             ← Active alerts
```

---

## 🔧 Configuration

### Backend `.env` File
```env
FLASK_ENV=development
PORT=5000
RAZORPAY_KEY_ID=rzp_test_aquaallot_demo2026
RAZORPAY_KEY_SECRET=test_secret_aquaallot2026
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://wokwi.com
```

### Frontend `.env` File
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_aquaallot_demo2026
```

---

## 💻 Hardware Components (Wokwi Simulation)

| Component | Model | Purpose | Pin |
|-----------|-------|---------|-----|
| Microcontroller | ESP32-WROOM-32 | Main controller | - |
| RFID Reader | MFRC522 | User authentication | SPI (GPIO 5, 1, 3, 21) |
| Flow Sensor | YF-S201 | Water measurement | GPIO 35 |
| Solenoid Valve | 12V Relay | Water dispensing control | GPIO 19 |
| OLED Display | SSD1306 (128×64) | Real-time status | I2C (GPIO 22, 23) |
| Status LEDs | 3× LEDs | System indicators | GPIO 27, 14, 12 |
| Buzzer | Active Buzzer | Alerts | GPIO 26 |
| Button | Push Button | Manual verification | GPIO 33 |

---

## 📊 Dashboard Features

### Real-time Metrics
- 💧 Total Water Dispensed (Today)
- 👥 Active Users
- 💰 Revenue Generation
- ⚠️ Anomalies Detected
- 📈 Flow Rate & Temperature

### Live Charts
- **Hourly Trend**: Dispensing volume + Revenue
- **Usage Distribution**: Today vs Week vs Month
- **Station Status**: Real-time monitoring

### Quick Actions
- 💳 Process Payment
- 🔓 Verify RFID
- 💧 Dispense Water
- 📋 View Alerts
- ⚙️ System Settings
- 📊 Analytics Report

---

## 💳 Payment Flow

```
1. User scans RFID card
   ↓
2. System verifies RFID UID with backend
   ↓
3. User selects amount (₹10-₹200)
   ↓
4. Frontend creates Razorpay order
   ↓
5. Backend verifies Razorpay signature (HMAC-SHA256)
   ↓
6. Payment authorized → ESP32 opens solenoid valve
   ↓
7. Flow sensor measures water dispensed
   ↓
8. Transaction & usage logged to database
   ↓
9. Anomaly detection checks for leaks/abuse
   ↓
10. Dashboard updates in real-time
```

---

## 🤖 Anomaly Detection (3-Sigma Rule)

### Formula
```
Anomaly Threshold = μ + 3σ
Where:
  μ (mu) = mean daily usage ≈ 2.8L
  σ (sigma) = standard deviation ≈ 0.8L
  Threshold ≈ 2.8 + 3(0.8) = 5.2L
```

### Detection Logic
- If consumption > 5.2L in single transaction → CRITICAL ALERT
- Email notification sent to administrators
- Valve closes immediately for safety
- Incident logged with user & station details

---

## 📝 Demo Test Data

### Users
```json
{
  "id": "USR001",
  "name": "Arun Kumar",
  "hostelBlock": "Hostel Block A",
  "roomNo": "A-204",
  "rfid": "A1B2C3D4",
  "balance": 250.5,
  "status": "Active"
}
```

### Stations
```
STN-001: Main Dispensing Point (Hostel A) - ONLINE
STN-002: Secondary Point (Hostel B) - ONLINE
STN-003: Backup Point (Hostel C) - ONLINE
```

### Test RFID Cards
- `A1B2C3D4` → Arun Kumar (Active)
- `E5F6G7H8` → Rahul Sharma (Active)

---

## 🧪 Testing Scenarios

### Scenario 1: Normal Dispensing
```
1. Scan RFID: A1B2C3D4
2. Select amount: ₹25 (5L)
3. Verify payment
4. Dispense: 4.96L
5. ✓ Transaction successful
```

### Scenario 2: Anomaly Detection
```
1. Scan RFID: E5F6G7H8
2. Dispense: 8.7L (exceeds 5.2L threshold)
3. 🚨 ANOMALY DETECTED
4. Alert sent: "Unusual Consumption Spike"
5. Valve closes immediately
6. Email: admin@aquaallot.com
```

### Scenario 3: Payment Failure
```
1. Invalid signature in payment verification
2. ✗ Payment rejected
3. Valve remains closed
4. Error message: "Payment verification failed"
```

---

## 📊 Understanding the Code Structure

### Frontend (React)
- **Dashboard.jsx**: Main metrics & charts
- **PaymentGateway.jsx**: RFID + Payment integration
- **Custom CSS**: Vibrant neon-themed styling

### Backend (Flask)
- **RFID Verification**: User lookup & validation
- **Payment Management**: Order creation & signature verification
- **Usage Logging**: Transaction & anomaly recording
- **Statistics**: 3-Sigma anomaly detection

### Embedded (Arduino/ESP32)
- **Hardware Control**: GPIO, I2C, SPI protocols
- **Sensor Integration**: RFID reader, flow sensor
- **Real-time Monitoring**: OLED display updates
- **Backend Communication**: HTTP requests via WiFi

---

## 🚀 Deployment Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] CORS headers configured
- [ ] Razorpay credentials set
- [ ] Database connected
- [ ] WiFi simulation active
- [ ] All 8 ESP32 events tested
- [ ] Anomaly detection validated
- [ ] Email alerts configured
- [ ] Dashboard responsive on mobile

---

## 📱 Live Updates & Real-time Sync

The system uses:
- **HTTP REST API** for backend communication
- **Auto-refresh** every 2 seconds on dashboard
- **WebSocket ready** for future live updates
- **Mock data** fallback for demo mode

---

## 🎯 Review 2 Demonstration Flow

1. **Show Dashboard** - Real-time metrics & live charts
2. **RFID Verification** - Scan test card on Wokwi
3. **Payment Processing** - Complete transaction flow
4. **Dispensing** - Watch flow sensor & valve control
5. **Anomaly Alert** - Trigger alert scenario
6. **Analytics** - Show usage patterns & insights

---

## 📞 Support & Documentation

- API Specs: See `docs/API_SPECIFICATION.md`
- Architecture: See `docs/SYSTEM_ARCHITECTURE.md`
- Testing Guide: See `docs/TESTING_GUIDE.md`
- Hardware: See Wokwi diagram in `esp32-wokwi/diagram.json`

---

## ✨ Key Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| RFID Authentication | ✅ Complete | MFRC522 integration |
| Payment Gateway | ✅ Complete | Razorpay HMAC-256 |
| Flow Monitoring | ✅ Complete | YF-S201 sensor |
| Anomaly Detection | ✅ Complete | 3-Sigma statistical |
| Dashboard | ✅ Complete | Vibrant React UI |
| Backend API | ✅ Complete | Flask REST endpoints |
| Wokwi Simulation | ✅ Complete | Full hardware diagram |
| Email Alerts | ✅ Ready | SMTP integration |
| Data Analytics | ✅ Complete | Recharts visualization |
| System Logging | ✅ Complete | Detailed event tracking |

---

## 🎓 Learning Resources

- **RFID**: `esp32-wokwi/sketch.ino` (lines 150-180)
- **Payment**: `backend/app.py` (lines 200-250)
- **Anomaly**: `backend/app.py` (lines 120-145)
- **Frontend**: `frontend/src/pages/Dashboard.jsx` (entire file)

---

**Status**: ✅ **Review 2 Ready**
**Last Updated**: September 2026
**Version**: 2.0.1

For detailed information, visit the individual documentation files in `docs/` folder.

---

*Created for open-source learning. AquaAllot - Smart Water Management for a Sustainable Future. 💧*
