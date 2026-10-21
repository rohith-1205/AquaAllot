import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import { Modal } from '../components/common/Modal';

export const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { users, transactions, anomalies, addUserBalance } = useApp();
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(100);

  const user = users.find((u) => u.id === id) || users[0];
  const userTransactions = transactions.filter((t) => t.userId === user.id);
  const userAnomalies = anomalies.filter((a) => a.userId === user.id);

  const mockUserDailyData = [
    { day: 'Mon', liters: user.avgDailyUsage * 0.8 },
    { day: 'Tue', liters: user.avgDailyUsage * 1.1 },
    { day: 'Wed', liters: user.avgDailyUsage * 0.9 },
    { day: 'Thu', liters: user.avgDailyUsage * 1.3 },
    { day: 'Fri', liters: user.avgDailyUsage * 1.5 },
    { day: 'Sat', liters: user.avgDailyUsage * 1.2 },
    { day: 'Sun', liters: user.todayUsage || user.avgDailyUsage }
  ];

  const handleAddBalanceSubmit = async (e) => {
    e.preventDefault();
    if (topUpAmount > 0) {
      try {
        await addUserBalance(user.id, topUpAmount);
        toast.success(`₹${topUpAmount} added to ${user.name}'s wallet!`);
        setIsTopUpModalOpen(false);
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

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
            Add Prepaid Balance
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
          <span className="text-3xl font-black text-emerald-400 font-['Outfit']">₹{user.balance}</span>
        </div>
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Water Used Today</span>
          <h3 className="text-2xl font-black text-sky-600 font-['Outfit'] mt-2">{user.todayUsage} L</h3>
          <p className="text-xs text-slate-500 mt-1">Daily cap: {user.avgDailyUsage} L/day</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Water Used</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{user.monthlyUsage} L</h3>
          <p className="text-xs text-emerald-600 font-bold mt-1">Normal hostel range</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Payments Done</span>
          <h3 className="text-2xl font-black text-emerald-600 font-['Outfit'] mt-2">₹{user.totalSpent}</h3>
          <p className="text-xs text-slate-500 mt-1">Via Razorpay sandbox</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Daily Volume</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{user.avgDailyUsage} L</h3>
          <p className="text-xs text-slate-500 mt-1">Computed over 30 days</p>
        </div>
      </div>

      {/* Individual Consumption Chart */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Weekly Water Dispensed ({user.name})</h3>
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockUserDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="userColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
              <Tooltip formatter={(val) => [`${val.toFixed(1)} L`, 'Water']} />
              <Area type="monotone" dataKey="liters" stroke="#06b6d4" strokeWidth={3} fill="url(#userColor)" />
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
                    <td className="font-bold text-emerald-600">₹{txn.amount}</td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td>
                      <Badge variant={txn.paymentStatus === 'Paid' ? 'success' : 'danger'}>
                        {txn.paymentStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={txn.dispensingStatus === 'Completed' ? 'success' : 'info'}>
                        {txn.dispensingStatus}
                      </Badge>
                    </td>
                    <td className="text-xs text-slate-500">{txn.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Balance Add */}
      <Modal isOpen={isTopUpModalOpen} onClose={() => setIsTopUpModalOpen(false)} title={`Top Up Balance for ${user.name}`}>
        <form onSubmit={handleAddBalanceSubmit} className="space-y-4">
          <div className="text-xs">
            <p className="text-slate-600">Hostel Block: <strong className="text-slate-900">{user.hostelBlock}</strong> ({user.roomNo})</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Top-up Amount (₹)</label>
            <input
              type="number"
              min="10"
              step="10"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsTopUpModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Top-Up</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UserDetails;
