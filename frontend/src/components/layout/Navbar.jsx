import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, Search, Bell, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { timeAgo } from '../../utils/format';

const pageTitles = {
  '/dashboard': { title: 'Dashboard Overview', subtitle: "Here's what's happening across your AquaAllot system today." },
  '/users': { title: 'User Management', subtitle: 'Students, RFID cards and daily consumption.' },
  '/dispensing': { title: 'New Water Order', subtitle: 'Send an order to the Wokwi station and pay with Razorpay.' },
  '/payments': { title: 'Payment History & Audit', subtitle: 'Track Razorpay digital transactions and revenue logs.' },
  '/analytics': { title: 'Consumption Analytics', subtitle: 'Explore water usage trends, peak demand, and station metrics.' },
  '/alerts': { title: 'Anomalies & System Alerts', subtitle: 'Daily limits, leaks, refunds & real-time warnings.' },
  '/live': { title: 'Live Station', subtitle: 'The Wokwi ESP32 in real time over MQTT.' },
  '/stations': { title: 'Stations & IoT Telemetry', subtitle: 'ESP32 controller state, YF-S201 flow sensors, and solenoid valves.' },
  '/settings': { title: 'System Settings', subtitle: 'Water price, daily water limit, station link and demo data.' }
};

export const Navbar = ({ setIsMobileOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { alerts, backendOnline } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentPath = location.pathname.startsWith('/users/') ? '/users' : location.pathname;
  const pageMeta = pageTitles[currentPath] || { title: 'AquaAllot System', subtitle: 'Smart Water Dispensing Platform' };

  const unresolvedAlerts = alerts.filter((a) => a.status === 'Unresolved');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-6 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Left side: Mobile Toggle & Page Info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-['Outfit']">
            {pageMeta.title}
          </h1>
          <p className="hidden sm:block text-xs font-medium text-slate-500 mt-0.5">
            {pageMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: Search, Demo Badge, Notifications, Admin Profile */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative hidden md:block w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search RFID, user, txn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>

        {/* Backend status */}
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            backendOnline ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/20' : 'bg-rose-100 text-rose-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{backendOnline ? 'LIVE BACKEND' : 'BACKEND OFFLINE · SAMPLE DATA'}</span>
        </span>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unresolvedAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fadeIn">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  System Alerts ({unresolvedAlerts.length})
                </h4>
                <Link
                  to="/alerts"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-sky-600 font-semibold hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {unresolvedAlerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    All systems operating normally.
                  </div>
                ) : (
                  unresolvedAlerts.map((alert) => (
                    <div key={alert.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            alert.severity === 'Critical' ? 'text-rose-500' : 'text-amber-500'
                          }`}
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{alert.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {alert.description}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {timeAgo(alert.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
            alt="Profile"
            className="w-9 h-9 rounded-full object-cover border-2 border-sky-500/30"
          />
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-500 font-medium">Hostel Campus A</p>
          </div>
        </div>
      </div>
    </header>
  );
};
