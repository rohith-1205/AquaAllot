import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { UserDetails } from './pages/UserDetails';
import { Dispensing } from './pages/Dispensing';
import { Payments } from './pages/Payments';
import { Analytics } from './pages/Analytics';
import { Alerts } from './pages/Alerts';
import { Stations } from './pages/Stations';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { KioskDispenser } from './pages/KioskDispenser';
import { LiveStation } from './pages/LiveStation';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { background: '#0f172a', color: '#ffffff', borderRadius: '0.75rem', fontSize: '0.875rem' }
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/kiosk" element={<KioskDispenser />} />
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="live" element={<LiveStation />} />
              <Route path="users" element={<Users />} />
              <Route path="users/:id" element={<UserDetails />} />
              <Route path="dispensing" element={<Dispensing />} />
              <Route path="payments" element={<Payments />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="stations" element={<Stations />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
