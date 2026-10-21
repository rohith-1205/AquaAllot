export const initialUsers = [
  {
    id: "USR001",
    name: "Arun Kumar",
    hostelBlock: "Hostel Block A",
    roomNo: "A-204",
    rfid: "A1B2C3D4",
    email: "arun@example.com",
    balance: 120,
    todayUsage: 4.2,
    monthlyUsage: 86.5,
    totalSpent: 432.5,
    status: "Active",
    avgDailyUsage: 2.8,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "USR002",
    name: "Rahul Sharma",
    hostelBlock: "Hostel Block B",
    roomNo: "B-112",
    rfid: "B2C3D4E5",
    email: "rahul@example.com",
    balance: 65,
    todayUsage: 8.7,
    monthlyUsage: 142.0,
    totalSpent: 710.0,
    status: "Warning",
    avgDailyUsage: 2.5,
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "USR003",
    name: "Priya Patel",
    hostelBlock: "Hostel Block A",
    roomNo: "A-305",
    rfid: "C3D4E5F6",
    email: "priya@example.com",
    balance: 240,
    todayUsage: 2.1,
    monthlyUsage: 62.4,
    totalSpent: 312.0,
    status: "Active",
    avgDailyUsage: 2.0,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "USR004",
    name: "Vikram Singh",
    hostelBlock: "PG Block C",
    roomNo: "C-101",
    rfid: "D4E5F6G7",
    email: "vikram@example.com",
    balance: 15,
    todayUsage: 1.5,
    monthlyUsage: 45.2,
    totalSpent: 226.0,
    status: "Active",
    avgDailyUsage: 1.8,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "USR005",
    name: "Ananya Roy",
    hostelBlock: "Hostel Block B",
    roomNo: "B-218",
    rfid: "E5F6G7H8",
    email: "ananya@example.com",
    balance: 310,
    todayUsage: 3.8,
    monthlyUsage: 94.0,
    totalSpent: 470.0,
    status: "Active",
    avgDailyUsage: 3.1,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "USR006",
    name: "Karthik N",
    hostelBlock: "PG Block C",
    roomNo: "C-302",
    rfid: "F6G7H8I9",
    email: "karthik@example.com",
    balance: 0,
    todayUsage: 0.0,
    monthlyUsage: 38.0,
    totalSpent: 190.0,
    status: "Inactive",
    avgDailyUsage: 1.5,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
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
    activeStation: "Station A-01"
  },
  {
    id: "HST-02",
    name: "Hostel Block B",
    type: "Girls Hostel",
    totalStudents: 95,
    waterDispensedToday: 382.0,
    totalPaymentsDone: 12800,
    activeStation: "Station A-02"
  },
  {
    id: "HST-03",
    name: "PG Block C",
    type: "Postgraduate Block",
    totalStudents: 60,
    waterDispensedToday: 245.0,
    totalPaymentsDone: 8900,
    activeStation: "Station A-03"
  }
];

export const initialStations = [
  {
    id: "STN-001",
    name: "Station A-01",
    location: "Hostel Block A - Ground Floor",
    hostelBlock: "Hostel Block A",
    status: "Online",
    flowRate: 4.8,
    todayUsage: 342.0,
    temperature: "24.5 °C",
    lastSync: 12,
    esp32: "Connected",
    rfidReader: "Operational",
    flowSensor: "Operational",
    solenoidValve: "Closed",
    oledDisplay: "Operational",
    wifiSignal: -42,
    firmware: "v2.4.1"
  },
  {
    id: "STN-002",
    name: "Station A-02",
    location: "Hostel Block B - 1st Floor",
    hostelBlock: "Hostel Block B",
    status: "Online",
    flowRate: 3.9,
    todayUsage: 287.0,
    temperature: "23.8 °C",
    lastSync: 8,
    esp32: "Connected",
    rfidReader: "Operational",
    flowSensor: "Operational",
    solenoidValve: "Closed",
    oledDisplay: "Operational",
    wifiSignal: -54,
    firmware: "v2.4.1"
  },
  {
    id: "STN-003",
    name: "Station A-03",
    location: "PG Block C - Dining Hall",
    hostelBlock: "PG Block C",
    status: "Warning",
    flowRate: 7.8,
    todayUsage: 421.0,
    temperature: "26.1 °C",
    lastSync: 5,
    esp32: "Connected",
    rfidReader: "Operational",
    flowSensor: "Warning: High Flow",
    solenoidValve: "Closed",
    oledDisplay: "Operational",
    wifiSignal: -61,
    firmware: "v2.4.0",
    alertMessage: "Unusual flow rate detected"
  }
];

export const initialTransactions = [
  {
    id: "TXN-1001",
    userId: "USR001",
    userName: "Arun Kumar",
    hostelBlock: "Hostel Block A",
    rfid: "A1B2C3D4",
    amount: 25,
    waterLiters: 5,
    paymentStatus: "Paid",
    dispensingStatus: "Completed",
    paymentMethod: "Razorpay (UPI)",
    razorpayPaymentId: "pay_N8z9K0xL1M2N3O",
    razorpayOrderId: "order_N8z9A0bC1D2E3F",
    stationId: "STN-001",
    timestamp: "2026-09-01 10:42:15"
  },
  {
    id: "TXN-1002",
    userId: "USR002",
    userName: "Rahul Sharma",
    hostelBlock: "Hostel Block B",
    rfid: "B2C3D4E5",
    amount: 50,
    waterLiters: 10,
    paymentStatus: "Paid",
    dispensingStatus: "Completed",
    paymentMethod: "Razorpay (Card)",
    razorpayPaymentId: "pay_P9a1L1yM2N3O4P",
    razorpayOrderId: "order_P9a1B0cD2E3F4G",
    stationId: "STN-003",
    timestamp: "2026-09-01 11:15:30"
  },
  {
    id: "TXN-1003",
    userId: "USR003",
    userName: "Priya Patel",
    hostelBlock: "Hostel Block A",
    rfid: "C3D4E5F6",
    amount: 10,
    waterLiters: 2,
    paymentStatus: "Paid",
    dispensingStatus: "Completed",
    paymentMethod: "Razorpay (NetBanking)",
    razorpayPaymentId: "pay_Q0b2M2zN3O4P5Q",
    razorpayOrderId: "order_Q0b2C0dE3F4G5H",
    stationId: "STN-002",
    timestamp: "2026-09-01 11:58:04"
  },
  {
    id: "TXN-1004",
    userId: "USR004",
    userName: "Vikram Singh",
    hostelBlock: "PG Block C",
    rfid: "D4E5F6G7",
    amount: 25,
    waterLiters: 5,
    paymentStatus: "Failed",
    dispensingStatus: "Failed",
    paymentMethod: "Razorpay (UPI)",
    razorpayPaymentId: "pay_R1c3N3aO4P5Q6R",
    razorpayOrderId: "order_R1c3D0eF4G5H6I",
    stationId: "STN-001",
    timestamp: "2026-09-01 12:20:45"
  },
  {
    id: "TXN-1005",
    userId: "USR005",
    userName: "Ananya Roy",
    hostelBlock: "Hostel Block B",
    rfid: "E5F6G7H8",
    amount: 25,
    waterLiters: 5,
    paymentStatus: "Paid",
    dispensingStatus: "Completed",
    paymentMethod: "Razorpay (UPI)",
    razorpayPaymentId: "pay_S2d4O4bP5Q6R7S",
    razorpayOrderId: "order_S2d4E0fG5H6I7J",
    stationId: "STN-002",
    timestamp: "2026-09-01 13:05:10"
  },
  {
    id: "TXN-1006",
    userId: "USR001",
    userName: "Arun Kumar",
    hostelBlock: "Hostel Block A",
    rfid: "A1B2C3D4",
    amount: 15,
    waterLiters: 3,
    paymentStatus: "Paid",
    dispensingStatus: "Completed",
    paymentMethod: "Prepaid Wallet",
    razorpayPaymentId: "wallet_internal_1006",
    razorpayOrderId: "ord_internal_1006",
    stationId: "STN-001",
    timestamp: "2026-09-01 14:12:00"
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
    id: "ALT-201",
    severity: "Critical",
    title: "Unusual Consumption Spike",
    description: "Student Rahul Sharma (Hostel Block B) exceeded daily threshold (+100% variance).",
    timestamp: "10 minutes ago",
    stationId: "STN-003",
    userId: "USR002",
    status: "Unresolved"
  },
  {
    id: "ALT-202",
    severity: "Warning",
    title: "High Flow Rate Detected",
    description: "Station A-03 (PG Block C) registered flow rate of 7.8 L/min.",
    timestamp: "25 minutes ago",
    stationId: "STN-003",
    userId: null,
    status: "Unresolved"
  },
  {
    id: "ALT-203",
    severity: "Warning",
    title: "Low User Balance Warning",
    description: "Student Vikram Singh (PG Block C) balance dropped to ₹15.",
    timestamp: "1 hour ago",
    stationId: null,
    userId: "USR004",
    status: "Resolved"
  }
];

export const initialAnomalies = [
  {
    id: "ANOM-01",
    userId: "USR002",
    userName: "Rahul Sharma",
    hostelBlock: "Hostel Block B",
    mean: 2.5,
    stdDev: 0.3,
    upperThreshold: 3.4,
    observed: 8.7,
    deviation: "+248%",
    severity: "Critical",
    reason: "Water consumption sharply exceeded 3-Sigma threshold (3.4 L). Potential valve leak or shared card.",
    timestamp: "Today, 11:15 AM",
    status: "Investigating"
  },
  {
    id: "ANOM-02",
    userId: "USR005",
    userName: "Ananya Roy",
    hostelBlock: "Hostel Block B",
    mean: 3.1,
    stdDev: 0.4,
    upperThreshold: 4.3,
    observed: 3.8,
    deviation: "+22%",
    severity: "Info",
    reason: "Normal upper range usage during weekend peak hours.",
    timestamp: "Today, 01:05 PM",
    status: "Cleared"
  }
];

export const stationComparisonData = [
  { station: "Hostel Block A", liters: 342, transactions: 42, efficiency: 99.4 },
  { station: "Hostel Block B", liters: 287, transactions: 35, efficiency: 98.9 },
  { station: "PG Block C", liters: 421, transactions: 58, efficiency: 96.2 }
];
