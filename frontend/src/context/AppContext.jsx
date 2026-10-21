import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  initialUsers,
  initialStations,
  initialTransactions,
  initialAlerts,
  initialAnomalies,
  initialAnalytics
} from '../services/mockData';

const AppContext = createContext();

// The station that the Wokwi ESP32 drives (same as WIRED_STATION_ID in the backend)
export const LIVE_STATION_ID = 'STN-001';

export const AppProvider = ({ children }) => {
  // Sample data is shown until the backend answers, then replaced by real data
  const [users, setUsers] = useState(initialUsers);
  const [stations, setStations] = useState(initialStations);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [anomalies, setAnomalies] = useState(initialAnomalies);
  const [analytics, setAnalytics] = useState(initialAnalytics);   // every dashboard number + chart
  const [settings, setSettings] = useState({ waterPricePerLiter: 5, dailyQuotaLiters: 10 });

  // Live Wokwi station: { mqtt, stations: [...], events: [...] }
  const [live, setLive] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null); // null = still checking

  // ---------- 1. Live station state (every second) ----------
  const loadLive = useCallback(async () => {
    try {
      setLive(await api.getLive());
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
    if (backendOnline !== true) return; // keep showing sample data until the backend answers
    try {
      const [uRes, sRes, tRes, aRes, analyticsRes, settingsRes] = await Promise.all([
        api.getUsers(),
        api.getStations(),
        api.getTransactions(200),
        api.getAlerts(100),
        api.getAnalytics(),
        api.getSettings()
      ]);
      if (uRes.offline) return; // backend went away between two polls
      setUsers(uRes.users);
      setStations(sRes.stations);
      setTransactions(tRes.transactions);
      setAlerts(aRes.alerts);
      setAnomalies(aRes.anomalies);
      setAnalytics(analyticsRes);
      setSettings(settingsRes.settings);
    } catch (err) {
      console.warn('Backend sync failed, showing last known data');
    }
  }, [backendOnline]);

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(loadBackendData, 3000);
    return () => clearInterval(interval);
  }, [loadBackendData]);

  // ---------- Actions ----------

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

  const saveSettings = async (changes) => {
    const res = await api.updateSettings(changes);
    setSettings(res.settings);
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

  // ---------- Live station shortcuts ----------
  const liveStation = live?.stations?.find((s) => s.stationId === LIVE_STATION_ID) || null;

  // ---------- Counters for the sidebar / navbar ----------
  const openAlerts = alerts.filter((a) => a.status === 'Unresolved');
  const kpis = {
    ...analytics.kpis,
    criticalAlertsCount: openAlerts.filter((a) => a.severity === 'Critical').length,
    warningAlertsCount: openAlerts.filter((a) => a.severity === 'Warning').length,
    totalAlertsCount: openAlerts.length
  };

  return (
    <AppContext.Provider
      value={{
        users,
        stations,
        transactions,
        alerts,
        anomalies,
        analytics,
        settings,
        waterPricePerLiter: settings.waterPricePerLiter,
        kpis,
        addNewUser,
        resolveAlert,
        saveSettings,
        resetDemoData,
        refresh: loadBackendData,
        // live Wokwi station
        backendOnline,
        liveStation,
        liveEvents: live?.events || [],
        mqttStatus: live?.mqtt || null,
        sendStationCommand
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
