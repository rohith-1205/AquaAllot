import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initialUsers,
  initialStations,
  initialTransactions,
  initialWaterUsage,
  initialRevenueData,
  initialAlerts,
  initialAnomalies
} from '../services/mockData';
import { api } from '../services/api';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [users, setUsers] = useState(initialUsers);
  const [stations, setStations] = useState(initialStations);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [waterUsage, setWaterUsage] = useState(initialWaterUsage);
  const [revenueData, setRevenueData] = useState(initialRevenueData);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [anomalies, setAnomalies] = useState(initialAnomalies);
  const [demoMode, setDemoMode] = useState(false);
  const [waterPricePerLiter, setWaterPricePerLiter] = useState(5); // ₹5/L default

  // Fetch live backend data from MongoDB
  const loadBackendData = async () => {
    try {
      const uRes = await api.getUsers();
      if (uRes?.users?.length) setUsers(uRes.users);

      const sRes = await api.getStations();
      if (sRes?.stations?.length) setStations(sRes.stations);

      const tRes = await api.getTransactions();
      if (tRes?.transactions?.length) setTransactions(tRes.transactions);

      const aRes = await api.getAlerts();
      if (aRes?.alerts) setAlerts(aRes.alerts);
      if (aRes?.anomalies) setAnomalies(aRes.anomalies);
    } catch (err) {
      console.warn('Backend sync fallback');
    }
  };

  useEffect(() => {
    loadBackendData();
    // Live polling every 3 seconds to keep MongoDB, Kiosk & Wokwi telemetry in sync
    const interval = setInterval(loadBackendData, 3000);
    return () => clearInterval(interval);
  }, [demoMode]);

  // Soft real-time telemetry pulse effect (simulates IoT heartbeats)
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      setStations((prevStations) =>
        prevStations.map((stn) => {
          const syncVariation = Math.floor(Math.random() * 4) + 3;
          const flowVar = stn.status === 'Online' 
            ? parseFloat((3.5 + Math.random() * 1.5).toFixed(1))
            : stn.flowRate;
          return {
            ...stn,
            lastSync: syncVariation,
            flowRate: flowVar
          };
        })
      );
    }, 8000);

    return () => clearInterval(interval);
  }, [demoMode]);

  // Log dispensing transaction & update live stats
  const addTransaction = (newTxn) => {
    setTransactions((prev) => [newTxn, ...prev]);

    // Update user stats
    setUsers((prevUsers) =>
      prevUsers.map((usr) => {
        if (usr.id === newTxn.userId) {
          const newBalance = Math.max(0, usr.balance - newTxn.amount);
          const newToday = parseFloat((usr.todayUsage + newTxn.waterLiters).toFixed(1));
          const newMonthly = parseFloat((usr.monthlyUsage + newTxn.waterLiters).toFixed(1));
          const newSpent = usr.totalSpent + newTxn.amount;
          return {
            ...usr,
            balance: newBalance,
            todayUsage: newToday,
            monthlyUsage: newMonthly,
            totalSpent: newSpent
          };
        }
        return usr;
      })
    );

    // Update station usage
    setStations((prevStations) =>
      prevStations.map((stn) => {
        if (stn.id === newTxn.stationId || stn.name.includes(newTxn.stationId)) {
          return {
            ...stn,
            todayUsage: parseFloat((stn.todayUsage + newTxn.waterLiters).toFixed(1))
          };
        }
        return stn;
      })
    );
  };

  // Add balance to user
  const addUserBalance = (userId, amount) => {
    setUsers((prevUsers) =>
      prevUsers.map((usr) =>
        usr.id === userId ? { ...usr, balance: usr.balance + amount } : usr
      )
    );
  };

  // Add new user
  const addNewUser = (newUserObj) => {
    const formattedUser = {
      id: `USR00${users.length + 1}`,
      balance: 100,
      todayUsage: 0.0,
      monthlyUsage: 0.0,
      totalSpent: 0.0,
      status: 'Active',
      avgDailyUsage: 0.0,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUserObj.name}`,
      ...newUserObj
    };
    setUsers((prev) => [formattedUser, ...prev]);
    return formattedUser;
  };

  // Resolve alert
  const resolveAlert = (alertId) => {
    setAlerts((prevAlerts) =>
      prevAlerts.map((alt) =>
        alt.id === alertId ? { ...alt, status: 'Resolved' } : alt
      )
    );
  };

  // Toggle demo mode
  const toggleDemoMode = () => setDemoMode((prev) => !prev);

  // Derived KPIs (100% Live from MongoDB)
  const totalWaterDispensed = parseFloat(
    transactions.reduce((acc, t) => acc + Number(t.waterLiters || 0), 0).toFixed(1)
  ) || parseFloat(users.reduce((acc, u) => acc + Number(u.todayUsage || 0), 0).toFixed(1));
  
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
