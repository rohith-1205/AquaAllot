import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Droplets,
  ShieldAlert,
  Building2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { TopUpModal } from '../components/common/TopUpModal';
import { api } from '../services/api';
import { formatDateTime, rupees } from '../utils/format';

export const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { users, transactions, anomalies, analytics, refresh } = useApp();
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState([]);   // real litres per day from the backend

  const user = users.find((u) => u.id === id) || users[0];
  const userTransactions = transactions.filter((t) => t.userId === user.id);
  const userAnomalies = anomalies.filter((a) => a.userId === user.id);

  // Normal usage / 3-sigma limit / daily quota, as calculated by the backend
  const profile = analytics.overuse?.find((row) => row.userId === user.id);

  useEffect(() => {
    api
      .getUserUsage(user.id)
      .then((res) => setWeeklyUsage(res.usage))
      .catch(() => setWeeklyUsage([]));
  }, [user.id, user.todayUsage]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/users')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Directory</span>
        </button>
        <div className="flex items-center gap-2">
          <Button icon={CreditCard} onClick={() => setIsTopUpModalOpen(true)}>
            Top up wallet (Razorpay)
          </Button>
          <Link to="/dispensing">
            <Button variant="secondary" icon={Droplets}>
              Purchase Water
            </Button>
          </Link>
        </div>
      </div>

      {/* Student Profile Card with Segregated Info */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-400/40 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black font-['Outfit']">{user.name}</h2>
              <Badge variant={user.status === 'Active' ? 'success' : user.status === 'Warning' ? 'warning' : 'danger'}>
                {user.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{user.email}</p>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-sky-400">
              <span className="flex items-center gap-1 text-slate-300 font-semibold">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" /> {user.hostelBlock || 'Hostel Block A'} ({user.roomNo || 'A-204'})
              </span>
              <span>Student ID: {user.id}</span>
              <span>RFID UID: {user.rfid}</span>
            </div>
          </div>
        </div>

        {/* Prepaid Wallet Balance Highlight */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-right shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prepaid Balance</span>
          <span className="text-3xl font-black text-emerald-400 font-['Outfit']">{rupees(user.balance)}</span>
        </div>
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Water Used Today</span>
          <h3 className="text-2xl font-black text-sky-600 font-['Outfit'] mt-2">{user.todayUsage} L</h3>
          <p className={`text-xs mt-1 font-semibold ${profile?.aboveNormal || profile?.overQuota ? 'text-rose-600' : 'text-slate-500'}`}>
            Limit {profile?.limit ?? '—'} L · quota {profile?.quota ?? user.dailyQuota} L
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Water Used</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{user.monthlyUsage} L</h3>
          <p className="text-xs text-slate-500 mt-1">This calendar month</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Payments Done</span>
          <h3 className="text-2xl font-black text-emerald-600 font-['Outfit'] mt-2">{rupees(user.totalSpent)}</h3>
          <p className="text-xs text-slate-500 mt-1">Charged from the wallet</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Normal Daily Use</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{profile?.mean ?? user.avgDailyUsage} L</h3>
          <p className="text-xs text-slate-500 mt-1">
            {profile?.learned ? `Learned from ${profile.historyDays} days of history` : 'Starting value (not enough history yet)'}
          </p>
        </div>
      </div>

      {/* Individual Consumption Chart */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Water dispensed – last 7 days ({user.name})</h3>
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="userColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
              <Tooltip formatter={(val) => [`${Number(val).toFixed(1)} L`, 'Water']} labelFormatter={(day, rows) => rows?.[0]?.payload?.date || day} />
              <Area isAnimationActive={false} type="monotone" dataKey="liters" stroke="#06b6d4" strokeWidth={3} fill="url(#userColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3-Sigma Anomaly Section if applicable */}
      {userAnomalies.length > 0 && (
        <div className="p-6 bg-rose-50 border border-rose-200/80 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>3-Sigma Anomaly Detected for {user.name}</span>
          </div>
          {userAnomalies.map((anom) => (
            <div key={anom.id} className="p-4 bg-white rounded-2xl border border-rose-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{anom.reason}</span>
                <Badge variant="danger">{anom.deviation}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-slate-600">
                <div>Mean: <strong className="text-slate-900">{anom.mean} L</strong></div>
                <div>Std Dev: <strong className="text-slate-900">{anom.stdDev} L</strong></div>
                <div>Upper Cap: <strong className="text-slate-900">{anom.upperThreshold} L</strong></div>
                <div>Observed: <strong className="text-rose-600 font-bold">{anom.observed} L</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Transaction & Payments History */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Payments & Dispensing History ({user.name})</h3>
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>TXN ID</th>
                <th>Hostel Zone</th>
                <th>Payments Done</th>
                <th>Water Volume</th>
                <th>Payment Status</th>
                <th>Dispensing Status</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {userTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    No transactions recorded for this student yet.
                  </td>
                </tr>
              ) : (
                userTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono font-bold text-sky-600">{txn.id}</td>
                    <td className="font-semibold text-slate-800">{txn.hostelBlock || user.hostelBlock}</td>
                    <td className="font-bold text-emerald-600">
                      {rupees(txn.amount)}
                      {txn.refund > 0 && <span className="block text-[10px] text-violet-500">+{rupees(txn.refund)} refunded</span>}
                    </td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td>
                      <Badge variant={txn.paymentStatus === 'Paid' ? 'success' : txn.paymentStatus === 'Partly refunded' ? 'info' : 'danger'}>
                        {txn.paymentStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={txn.dispensingStatus === 'Completed' ? 'success' : txn.dispensingStatus === 'Dispensing' ? 'info' : 'danger'}>
                        {txn.dispensingStatus}
                      </Badge>
                    </td>
                    <td className="text-xs text-slate-500">{formatDateTime(txn.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Balance Add */}
      <TopUpModal user={isTopUpModalOpen ? user : null} onClose={() => setIsTopUpModalOpen(false)} onDone={refresh} />
    </div>
  );
};

export default UserDetails;
