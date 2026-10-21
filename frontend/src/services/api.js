import axios from 'axios';
import { initialUsers, initialStations, initialTransactions, initialAlerts, initialAnomalies } from './mockData';

// The backend runs on port 5000 of the same computer that serves the dashboard
// (works for localhost and for a phone on the same WiFi).
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000
});

// For actions that MUST reach the real backend (no sample-data fallback).
// Returns the response body, or throws an Error with the backend's message.
const request = async (method, url, data, timeout = 8000) => {
  try {
    const response = await axiosInstance.request({ method, url, data, timeout });
    return response.data;
  } catch (err) {
    const message = err.response?.data?.message || 'Backend not reachable. Run "npm run dev" inside the backend folder.';
    throw new Error(message);
  }
};

// For reads: if the backend is down, show the sample data instead of an empty page.
const readWithFallback = async (url, fallback) => {
  try {
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (err) {
    return { success: true, offline: true, ...fallback };
  }
};

// '01:02:03:04', '01 02 03 04' and '01020304' are the same card
export const normalizeCard = (uid = '') => uid.toUpperCase().replace(/[^0-9A-Z]/g, '');

export const api = {
  // ---------- Reads (sample data when the backend is offline) ----------
  getUsers: () => readWithFallback('/users', { users: initialUsers }),
  getStations: () => readWithFallback('/stations', { stations: initialStations }),
  getTransactions: (limit = 200) => readWithFallback(`/transactions?limit=${limit}`, { transactions: initialTransactions }),
  getAlerts: (limit = 100) => readWithFallback(`/alerts?limit=${limit}`, { alerts: initialAlerts, anomalies: initialAnomalies }),

  // ---------- Reads that need the real backend ----------
  getLive: () => request('get', '/live', undefined, 3000),
  getAnalytics: () => request('get', '/analytics'),
  getSettings: () => request('get', '/settings'),
  getUserUsage: (userId) => request('get', `/users/${userId}/usage`),
  getTopups: (limit = 100) => request('get', `/topups?limit=${limit}`),
  verifyRfid: (rfidUid) => request('post', '/verify_rfid', { rfid_uid: rfidUid }),

  // ---------- Live Wokwi station ----------
  stationCommand: (stationId, action, params = {}) => request('post', `/stations/${stationId}/command`, { action, ...params }),
  payOrderFromWallet: (orderId) => request('post', `/orders/${orderId}/pay`),

  // ---------- Wallet top-up (Razorpay) ----------
  topupCheckout: (userId, amount) => request('post', `/users/${userId}/topup/checkout`, { amount }, 15000),
  topupConfirm: (topupId, payment) => request('post', `/topups/${topupId}/confirm`, payment),

  // ---------- Admin ----------
  createUser: (user) => request('post', '/users', user),
  resolveAlert: (alertId) => request('post', `/alerts/${alertId}/resolve`),
  updateSettings: (settings) => request('put', '/settings', settings),
  resetDemo: () => request('post', '/admin/reset_demo')
};
