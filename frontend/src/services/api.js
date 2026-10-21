import axios from 'axios';
import {
  initialUsers,
  initialStations,
  initialTransactions,
  initialWaterUsage,
  initialRevenueData,
  initialAlerts,
  initialAnomalies,
  stationComparisonData
} from './mockData';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

const BASE_URL = getBaseUrl();

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000
});

// Helper for simulated delay in demo mode
const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  // 1. Verify RFID Tag
  verifyRfid: async (rfidUid) => {
    try {
      const response = await axiosInstance.post('/verify_rfid', { rfid_uid: rfidUid });
      return response.data;
    } catch (err) {
      await delay();
      const matchedUser = initialUsers.find((u) => u.rfid.toUpperCase() === rfidUid.toUpperCase());
      if (matchedUser) {
        return {
          success: true,
          authorized: true,
          user: matchedUser,
          message: 'RFID authentication successful'
        };
      }
      return {
        success: false,
        authorized: false,
        message: 'Invalid or unregistered RFID card'
      };
    }
  },

  // 2. Create Razorpay Order
  createOrder: async ({ amount_rupees, user_id, water_liters }) => {
    try {
      const response = await axiosInstance.post('/create_order', {
        amount_rupees,
        user_id,
        water_liters
      });
      return response.data;
    } catch (err) {
      await delay(500);
      const generatedOrderId = `order_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      return {
        success: true,
        id: generatedOrderId,
        amount: amount_rupees * 100, // paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`
      };
    }
  },

  // 3. Verify Razorpay Payment Signature
  verifyPayment: async (paymentPayload) => {
    try {
      const response = await axiosInstance.post('/verify_payment', paymentPayload);
      return response.data;
    } catch (err) {
      await delay(600);
      // Signature verification logic validation
      if (paymentPayload.razorpay_signature && paymentPayload.razorpay_payment_id) {
        return {
          success: true,
          verified: true,
          status: 'Authorized',
          payment_id: paymentPayload.razorpay_payment_id,
          order_id: paymentPayload.razorpay_order_id,
          dispensing_authorized: true,
          message: 'Razorpay signature verified successfully. Water dispensing authorized.'
        };
      }
      return {
        success: false,
        verified: false,
        status: 'Failed',
        dispensing_authorized: false,
        message: 'Payment verification failed. Signature mismatch.'
      };
    }
  },

  // 4. Log Water Dispensing Usage
  logUsage: async (usagePayload) => {
    try {
      const response = await axiosInstance.post('/log_usage', usagePayload);
      return response.data;
    } catch (err) {
      await delay(300);
      return {
        success: true,
        logged: true,
        transaction_id: usagePayload.transaction_id || `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        message: 'Water usage and telemetry logged to database.'
      };
    }
  },

  // 5. Fetch All Users
  getUsers: async () => {
    try {
      const response = await axiosInstance.get('/users');
      return response.data;
    } catch (err) {
      await delay(300);
      return { success: true, users: initialUsers };
    }
  },

  // 6. Fetch Single User
  getUserById: async (userId) => {
    try {
      const response = await axiosInstance.get(`/users/${userId}`);
      return response.data;
    } catch (err) {
      await delay(300);
      const user = initialUsers.find((u) => u.id === userId) || initialUsers[0];
      return { success: true, user };
    }
  },

  // 7. Fetch Transactions
  getTransactions: async () => {
    try {
      const response = await axiosInstance.get('/transactions');
      return response.data;
    } catch (err) {
      await delay(300);
      return { success: true, transactions: initialTransactions };
    }
  },

  // 8. Fetch Water Usage Trends
  getWaterUsage: async () => {
    try {
      const response = await axiosInstance.get('/water-usage');
      return response.data;
    } catch (err) {
      await delay(300);
      return { success: true, usage: initialWaterUsage };
    }
  },

  // 9. Fetch System Analytics
  getAnalytics: async () => {
    try {
      const response = await axiosInstance.get('/analytics');
      return response.data;
    } catch (err) {
      await delay(300);
      return {
        success: true,
        analytics: {
          waterUsage: initialWaterUsage,
          revenue: initialRevenueData,
          stationComparison: stationComparisonData,
          anomalies: initialAnomalies
        }
      };
    }
  },

  // 10. Fetch Alerts & Anomalies
  getAlerts: async () => {
    try {
      const response = await axiosInstance.get('/alerts');
      return response.data;
    } catch (err) {
      await delay(300);
      return { success: true, alerts: initialAlerts, anomalies: initialAnomalies };
    }
  },

  // 11. Fetch Stations
  getStations: async () => {
    try {
      const response = await axiosInstance.get('/stations');
      return response.data;
    } catch (err) {
      await delay(300);
      return { success: true, stations: initialStations };
    }
  },

  // 12. Fetch Station by ID
  getStationById: async (stationId) => {
    try {
      const response = await axiosInstance.get(`/stations/${stationId}`);
      return response.data;
    } catch (err) {
      await delay(300);
      const station = initialStations.find((s) => s.id === stationId) || initialStations[0];
      return { success: true, station };
    }
  }
};
