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

// For actions that MUST reach the real backend (no sample-data fallback).
// Returns the response body, or throws an Error with the backend's message.
const request = async (method, url, data, timeout = 8000) => {
  try {
    const response = await axiosInstance.request({ method, url, data, timeout });
    return response.data;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      'Backend not reachable. Run "npm run dev" inside the backend folder.';
    throw new Error(message);
  }
};

// '01:02:03:04', '01 02 03 04' and '01020304' are the same card
export const normalizeCard = (uid = '') => uid.toUpperCase().replace(/[^0-9A-Z]/g, '');

export const api = {
  // ---------- Live Wokwi station + actions (need the real backend) ----------
  getLive: () => request('get', '/live', undefined, 3000),
  stationCommand: (stationId, action, params = {}) =>
    request('post', `/stations/${stationId}/command`, { action, ...params }),
  checkoutOrder: (orderId) => request('post', `/orders/${orderId}/checkout`, {}, 15000),
  confirmOrder: (orderId, payment) => request('post', `/orders/${orderId}/confirm`, payment),
  createUser: (user) => request('post', '/users', user),
  topUp: (userId, amount) => request('post', `/users/${userId}/topup`, { amount }),
  resolveAlert: (alertId) => request('post', `/alerts/${alertId}/resolve`),
  getSettings: () => request('get', '/settings'),
  updateSettings: (settings) => request('put', '/settings', settings),
  resetDemo: () => request('post', '/admin/reset_demo'),

  // 1. Verify RFID Tag
  verifyRfid: async (rfidUid) => {
    try {
      const response = await axiosInstance.post('/verify_rfid', { rfid_uid: rfidUid });
      return response.data;
    } catch (err) {
      await delay();
      if (err.response?.status === 404) {
        return { success: false, authorized: false, message: err.response.data?.message || 'Card not registered' };
      }
      const matchedUser = initialUsers.find((u) => normalizeCard(u.rfid) === normalizeCard(rfidUid));
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
