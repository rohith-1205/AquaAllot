import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Droplets,
  CreditCard,
  BarChart3,
  AlertTriangle,
  Radio,
  Settings,
  Smartphone,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const { user, logout } = useAuth();
  const { kpis } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Dispenser Kiosk', path: '/kiosk', icon: Smartphone, badge: 'Mobile' },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Dispensing', path: '/dispensing', icon: Droplets, badge: 'Pay' },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle, count: kpis?.totalAlertsCount },
    { name: 'Stations', path: '/stations', icon: Radio, count: `${kpis?.activeStationsCount}/${kpis?.totalStationsCount}` },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20">
              <Droplets className="w-6 h-6 fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white font-['Outfit']">
                Aqua<span className="text-cyan-400">Allot</span>
              </h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-sky-400">
                IoT Water Allocation
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1 text-slate-400 hover:text-white lg:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-400 text-slate-950">
                  {item.badge}
                </span>
              )}
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    item.name === 'Alerts'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
          {/* System Status Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-300">ESP32 Telemetry</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">ONLINE</span>
          </div>

          {/* Admin Profile & Logout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt="Admin"
                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
              />
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'Admin'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.role || 'Administrator'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
