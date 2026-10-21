// Sample data shown ONLY while the backend is not running.
// It mirrors backend/demo_data.py (same users and Wokwi RFID cards) so the
// dashboard looks the same before and after the backend starts.

export const initialUsers = [
  {
    "id": "USR001",
    "name": "Rohith",
    "email": "rohith@aquaallot.demo",
    "hostelBlock": "Hostel Block A",
    "roomNo": "A-204",
    "rfid": "01:02:03:04",
    "rfidCard": "Wokwi Blue card",
    "balance": 150.0,
    "todayUsage": 0.0,
    "monthlyUsage": 64.5,
    "totalSpent": 322.5,
    "avgDailyUsage": 3.0,
    "usageStdDev": 0.8,
    "status": "Active",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohith"
  },
  {
    "id": "USR002",
    "name": "Deepankishor",
    "email": "deepankishor@aquaallot.demo",
    "hostelBlock": "Hostel Block B",
    "roomNo": "B-112",
    "rfid": "11:22:33:44",
    "rfidCard": "Wokwi Green card",
    "balance": 8.0,
    "todayUsage": 0.0,
    "monthlyUsage": 58.0,
    "totalSpent": 290.0,
    "avgDailyUsage": 2.6,
    "usageStdDev": 0.7,
    "status": "Active",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Deepankishor"
  },
  {
    "id": "USR003",
    "name": "Sanjay",
    "email": "sanjay@aquaallot.demo",
    "hostelBlock": "Hostel Block A",
    "roomNo": "A-305",
    "rfid": "55:66:77:88",
    "rfidCard": "Wokwi Yellow card",
    "balance": 200.0,
    "todayUsage": 0.0,
    "monthlyUsage": 41.0,
    "totalSpent": 205.0,
    "avgDailyUsage": 1.5,
    "usageStdDev": 0.5,
    "status": "Active",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Sanjay"
  },
  {
    "id": "USR004",
    "name": "Karthik N",
    "email": "karthik@aquaallot.demo",
    "hostelBlock": "PG Block C",
    "roomNo": "C-302",
    "rfid": "C0:FF:EE:99",
    "rfidCard": "Wokwi Key fob",
    "balance": 0.0,
    "todayUsage": 0.0,
    "monthlyUsage": 38.0,
    "totalSpent": 190.0,
    "avgDailyUsage": 1.5,
    "usageStdDev": 0.5,
    "status": "Suspended",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Karthik"
  },
  {
    "id": "USR005",
    "name": "Priya Patel",
    "email": "priya@aquaallot.demo",
    "hostelBlock": "Hostel Block A",
    "roomNo": "A-118",
    "rfid": "DE:AD:BE:EF",
    "rfidCard": "Physical card",
    "balance": 240.0,
    "todayUsage": 2.0,
    "monthlyUsage": 62.4,
    "totalSpent": 312.0,
    "avgDailyUsage": 2.0,
    "usageStdDev": 0.6,
    "status": "Active",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya"
  },
  {
    "id": "USR006",
    "name": "Ananya Roy",
    "email": "ananya@aquaallot.demo",
    "hostelBlock": "Hostel Block B",
    "roomNo": "B-218",
    "rfid": "CA:FE:BA:BE",
    "rfidCard": "Physical card",
    "balance": 310.0,
    "todayUsage": 3.0,
    "monthlyUsage": 94.0,
    "totalSpent": 470.0,
    "avgDailyUsage": 3.1,
    "usageStdDev": 0.9,
    "status": "Active",
    "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya"
  }
];

export const initialHostels = [
  {
    id: "HST-01",
    name: "Hostel Block A",
    type: "Boys Hostel",
    totalStudents: 120,
    waterDispensedToday: 428.5,
    totalPaymentsDone: 14500,
    activeStation: "Wokwi ESP32 Station"
  },
  {
    id: "HST-02",
    name: "Hostel Block B",
    type: "Girls Hostel",
    totalStudents: 95,
    waterDispensedToday: 382.0,
    totalPaymentsDone: 12800,
    activeStation: "Station B-01 (sample)"
  },
  {
    id: "HST-03",
    name: "PG Block C",
    type: "Postgraduate Block",
    totalStudents: 60,
    waterDispensedToday: 245.0,
    totalPaymentsDone: 8900,
    activeStation: "Station C-01 (sample)"
  }
];

export const initialStations = [
  {
    "rfidReader": "Operational",
    "flowSensor": "Operational",
    "oledDisplay": "Operational",
    "id": "STN-001",
    "name": "Wokwi ESP32 Station",
    "location": "Hostel Block A - Ground Floor",
    "hostelBlock": "Hostel Block A",
    "isLive": true,
    "status": "Offline",
    "esp32": "Waiting for Wokwi",
    "solenoidValve": "Closed",
    "flowRate": 0.0,
    "todayUsage": 0.0,
    "temperature": "-",
    "lastSync": null,
    "wifiSignal": null,
    "firmware": "-"
  },
  {
    "rfidReader": "Operational",
    "flowSensor": "Operational",
    "oledDisplay": "Operational",
    "id": "STN-002",
    "name": "Station B-01 (sample)",
    "location": "Hostel Block B - 1st Floor",
    "hostelBlock": "Hostel Block B",
    "isLive": false,
    "status": "Online",
    "esp32": "Connected",
    "solenoidValve": "Closed",
    "flowRate": 3.9,
    "todayUsage": 287.0,
    "temperature": "23.8 °C",
    "lastSync": 8,
    "wifiSignal": -54,
    "firmware": "v3.0.0"
  },
  {
    "rfidReader": "Operational",
    "flowSensor": "Warning: High Flow",
    "oledDisplay": "Operational",
    "id": "STN-003",
    "name": "Station C-01 (sample)",
    "location": "PG Block C - Dining Hall",
    "hostelBlock": "PG Block C",
    "isLive": false,
    "status": "Warning",
    "esp32": "Connected",
    "solenoidValve": "Closed",
    "alertMessage": "Unusual flow rate detected",
    "flowRate": 7.8,
    "todayUsage": 421.0,
    "temperature": "26.1 °C",
    "lastSync": 5,
    "wifiSignal": -61,
    "firmware": "v3.0.0"
  }
];

export const initialTransactions = [
  {
    "id": "TXN-1006",
    "userId": "USR001",
    "userName": "Rohith",
    "hostelBlock": "Hostel Block A",
    "rfid": "01:02:03:04",
    "amount": 10,
    "waterLiters": 2,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Wallet",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-001",
    "timestamp": "2026-10-21 16:52:41"
  },
  {
    "id": "TXN-1005",
    "userId": "USR005",
    "userName": "Priya Patel",
    "hostelBlock": "Hostel Block A",
    "rfid": "DE:AD:BE:EF",
    "amount": 10,
    "waterLiters": 2,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Razorpay (UPI)",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-002",
    "timestamp": "2026-10-21 14:52:41"
  },
  {
    "id": "TXN-1004",
    "userId": "USR006",
    "userName": "Ananya Roy",
    "hostelBlock": "Hostel Block B",
    "rfid": "CA:FE:BA:BE",
    "amount": 5,
    "waterLiters": 1,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Razorpay (Card)",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-003",
    "timestamp": "2026-10-21 12:52:41"
  },
  {
    "id": "TXN-1003",
    "userId": "USR002",
    "userName": "Deepankishor",
    "hostelBlock": "Hostel Block B",
    "rfid": "11:22:33:44",
    "amount": 25,
    "waterLiters": 5,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Razorpay (UPI)",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-001",
    "timestamp": "2026-10-20 21:52:41"
  },
  {
    "id": "TXN-1002",
    "userId": "USR003",
    "userName": "Sanjay",
    "hostelBlock": "Hostel Block A",
    "rfid": "55:66:77:88",
    "amount": 5,
    "waterLiters": 1,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Wallet",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-001",
    "timestamp": "2026-10-20 15:52:41"
  },
  {
    "id": "TXN-1001",
    "userId": "USR006",
    "userName": "Ananya Roy",
    "hostelBlock": "Hostel Block B",
    "rfid": "CA:FE:BA:BE",
    "amount": 10,
    "waterLiters": 2,
    "paymentStatus": "Paid",
    "dispensingStatus": "Completed",
    "paymentMethod": "Wallet",
    "razorpayPaymentId": null,
    "razorpayOrderId": null,
    "stationId": "STN-002",
    "timestamp": "2026-10-20 11:52:41"
  }
];

export const initialWaterUsage = {
  today: [
    { time: "06:00 AM", liters: 45, users: 12 },
    { time: "08:00 AM", liters: 140, users: 48 },
    { time: "10:00 AM", liters: 210, users: 65 },
    { time: "12:00 PM", liters: 185, users: 54 },
    { time: "02:00 PM", liters: 160, users: 42 },
    { time: "04:00 PM", liters: 230, users: 71 },
    { time: "06:00 PM", liters: 280, users: 89 },
    { time: "08:00 PM", liters: 234, users: 76 }
  ],
  thisWeek: [
    { day: "Mon", liters: 320, revenue: 1600 },
    { day: "Tue", liters: 410, revenue: 2050 },
    { day: "Wed", liters: 380, revenue: 1900 },
    { day: "Thu", liters: 450, revenue: 2250 },
    { day: "Fri", liters: 510, revenue: 2550 },
    { day: "Sat", liters: 430, revenue: 2150 },
    { day: "Sun", liters: 390, revenue: 1950 }
  ],
  thisMonth: [
    { week: "Week 1", liters: 2450, revenue: 12250 },
    { week: "Week 2", liters: 2890, revenue: 14450 },
    { week: "Week 3", liters: 3120, revenue: 15600 },
    { week: "Week 4", liters: 2980, revenue: 14900 }
  ]
};

export const initialRevenueData = [
  { label: "Mon", amount: 1600 },
  { label: "Tue", amount: 2050 },
  { label: "Wed", amount: 1900 },
  { label: "Thu", amount: 2250 },
  { label: "Fri", amount: 2550 },
  { label: "Sat", amount: 2150 },
  { label: "Sun", amount: 1950 }
];

export const initialAlerts = [
  {
    "id": "ALT-201",
    "severity": "Warning",
    "title": "High Flow Rate Detected (sample)",
    "description": "Station C-01 registered a flow rate of 7.8 L/min.",
    "timestamp": "25 minutes ago",
    "stationId": "STN-003",
    "userId": null,
    "status": "Unresolved"
  }
];

export const initialAnomalies = [];

export const stationComparisonData = [
  { station: "Hostel Block A", liters: 342, transactions: 42, efficiency: 99.4 },
  { station: "Hostel Block B", liters: 287, transactions: 35, efficiency: 98.9 },
  { station: "PG Block C", liters: 421, transactions: 58, efficiency: 96.2 }
];
