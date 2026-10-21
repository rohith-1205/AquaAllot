import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  initialUsers,
  initialStations,
  initialTransactions,
  initialWaterUsage,
  initialRevenueData,
  initialAlerts,
  initialAnomalies
} from '../services/mockData';

const AppContext = createContext();

// The station that the Wokwi ESP32 drives (same as WIRED_STATION_ID in the backend)
export const LIVE_STATION_ID = 'STN-001';

export const AppProvider = ({ children }) => {
  // Sample data is shown until the backend answers, then replaced by real data
  const [users, setUsers] = useState(initialUsers);
  const [stations, setStations] = useState(initialStations);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [waterUsage] = useState(initialWaterUsage);
  const [revenueData] = useState(initialRevenueData);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [anomalies, setAnomalies] = useState(initialAnomalies);
  const [demoMode, setDemoMode] = useState(false);
  const [waterPricePerLiter, setWaterPrice] = useState(5); // ₹5/L default

  // Live Wokwi station: { mqtt, stations: [...], events: [...] }
  const [live, setLive] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null); // null = still checking

  // ---------- 1. Live station state (every second) ----------
  const loadLive = useCallback(async () => {
    try {
      const data = await api.getLive();
      setLive(data);
      setBackendOnline(true);
    } catch (err) {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, 1000);
    return () => clearInterval(interval);
  }, [loadLive]);

  // ---------- 2. Everything else (every 3 seconds) ----------
  const loadBackendData = useCallback(async () => {
    if (backendOnline === false) return; // keep showing sample data until the backend is back
    try {
      const [uRes, sRes, tRes, aRes, settingsRes] = await Promise.all([
        api.getUsers(),
        api.getStations(),
        api.getTransactions(),
        api.getAlerts(),
        api.getSettings()
      ]);
      if (uRes?.users) setUsers(uRes.users);
      if (sRes?.stations) setStations(sRes.stations);
      if (tRes?.transactions) setTransactions(tRes.transactions);
      if (aRes?.alerts) setAlerts(aRes.alerts);
      if (aRes?.anomalies) setAnomalies(aRes.anomalies);
      if (settingsRes?.settings?.waterPricePerLiter) setWaterPrice(settingsRes.settings.waterPricePerLiter);
    } catch (err) {
      console.warn('Backend sync failed, showing last known data');
    }
  }, [backendOnline]);

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(loadBackendData, 3000);
    return () => clearInterval(interval);
  }, [loadBackendData]);

  // Demo mode: small random flow changes on the SAMPLE stations only (never on the live Wokwi one)
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      setStations((prev) =>
        prev.map((stn) =>
          stn.isLive || stn.status !== 'Online'
            ? stn
            : {
                ...stn,
                lastSync: Math.floor(Math.random() * 4) + 3,
                flowRate: parseFloat((3.5 + Math.random() * 1.5).toFixed(1))
              }
        )
      );
    }, 8000);
    return () => clearInterval(interval);
  }, [demoMode]);

  // ---------- Actions ----------

  // Kiosk / Dispensing pages: show the new transaction at once (the backend copy arrives on the next sync)
  const addTransaction = (newTxn) => {
    setTransactions((prev) => [newTxn, ...prev]);
    setUsers((prevUsers) =>
      prevUsers.map((usr) =>
        usr.id === newTxn.userId
          ? {
              ...usr,
              todayUsage: parseFloat((usr.todayUsage + newTxn.waterLiters).toFixed(1)),
              monthlyUsage: parseFloat((usr.monthlyUsage + newTxn.waterLiters).toFixed(1)),
              totalSpent: usr.totalSpent + newTxn.amount
            }
          : usr
      )
    );
  };

  const addUserBalance = async (userId, amount) => {
    await api.topUp(userId, amount);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, balance: u.balance + amount } : u)));
  };

  // Register a student + RFID card in the backend (so the card works in Wokwi immediately)
  const addNewUser = async (newUser) => {
    const res = await api.createUser(newUser);
    setUsers((prev) => [res.user, ...prev]);
    return res.user;
  };

  const resolveAlert = async (alertId) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'Resolved' } : a)));
    await api.resolveAlert(alertId);
  };

  const setWaterPricePerLiter = async (price) => {
    await api.updateSettings({ waterPricePerLiter: price });
    setWaterPrice(price);
  };

  // Dashboard buttons → ESP32 (tap_card, start_order, stop, reset)
  const sendStationCommand = async (action, params = {}) => {
    const res = await api.stationCommand(LIVE_STATION_ID, action, params);
    loadLive();
    return res;
  };

  const resetDemoData = async () => {
    await api.resetDemo();
    await loadBackendData();
  };

  const toggleDemoMode = () => setDemoMode((prev) => !prev);

  // ---------- Live station shortcuts ----------
  const liveStation = live?.stations?.find((s) => s.stationId === LIVE_STATION_ID) || null;
  const liveEvents = live?.events || [];
  const mqttStatus = live?.mqtt || null;

  // ---------- KPIs ----------
  const totalWaterDispensed = parseFloat(
    transactions.reduce((acc, t) => acc + Number(t.waterLiters || 0), 0).toFixed(1)
  );
  const totalRevenue = transactions
    .filter((t) => t.paymentStatus === 'Paid' || t.status === 'Paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const activeUsersCount = users.filter((u) => u.status === 'Active').length;
  const activeStationsCount = stations.filter((s) => s.status === 'Online').length;
  const criticalAlertsCount = alerts.filter((a) => a.severity === 'Critical' && a.status === 'Unresolved').length;
  const warningAlertsCount = alerts.filter((a) => a.severity === 'Warning' && a.status === 'Unresolved').length;

  return (
    <AppContext.Provider
      value={{
        users,
        stations,
        transactions,
        waterUsage,
        revenueData,
        alerts,
        anomalies,
        demoMode,
        waterPricePerLiter,
        setWaterPricePerLiter,
        toggleDemoMode,
        addTransaction,
        addUserBalance,
        addNewUser,
        resolveAlert,
        resetDemoData,
        // live Wokwi station
        backendOnline,
        liveStation,
        liveEvents,
        mqttStatus,
        sendStationCommand,
        kpis: {
          totalWaterDispensed,
          totalRevenue,
          activeUsersCount,
          activeStationsCount,
          totalStationsCount: stations.length,
          criticalAlertsCount,
          warningAlertsCount,
          totalAlertsCount: criticalAlertsCount + warningAlertsCount
        }
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
