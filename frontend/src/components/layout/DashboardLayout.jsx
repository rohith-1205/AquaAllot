import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const DashboardLayout = () => {
  const { isAuthenticated } = useAuth();
  const { backendOnline } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-['Plus_Jakarta_Sans']">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }
        }}
      />
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar setIsMobileOpen={setIsMobileOpen} />
        {backendOnline === false && (
          <div className="px-6 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border-b border-amber-200">
            ⚠ Backend not reachable – showing sample data. Start it with <code className="font-mono">cd backend → npm run dev</code>
          </div>
        )}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
