import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, IndianRupee, CheckCircle2, XCircle, Search, Filter, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const Payments = () => {
  const { transactions, kpis } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | Paid | Failed | Pending

  const filteredTxns = transactions.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.razorpayPaymentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.rfid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : t.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const successfulTxnsCount = transactions.filter((t) => t.paymentStatus === 'Paid').length;
  const failedTxnsCount = transactions.filter((t) => t.paymentStatus === 'Failed').length;
  const todaysRevenue = transactions
    .filter((t) => t.paymentStatus === 'Paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleExportCSV = () => {
    toast.success('Exporting transactions audit CSV...');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">Digital Payment Audit & Transactions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Razorpay gateway transaction records, signature verification status, and audit logs.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" icon={Download}>
          Export CSV Audit Log
        </Button>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue Collected</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">₹{kpis.totalRevenue.toLocaleString()}</h3>
          <p className="text-xs text-emerald-600 font-bold mt-1">+8.2% vs last week</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Digital Revenue</span>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">₹{todaysRevenue}</h3>
          <p className="text-xs text-slate-500 mt-1">Live Razorpay payments</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Successful Transactions</span>
          <h3 className="text-2xl font-black text-emerald-600 font-['Outfit'] mt-2">{successfulTxnsCount}</h3>
          <p className="text-xs text-slate-500 mt-1">Verified signature rate 98.4%</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Failed / Rejected</span>
          <h3 className="text-2xl font-black text-rose-600 font-['Outfit'] mt-2">{failedTxnsCount}</h3>
          <p className="text-xs text-slate-500 mt-1">Gateway timeouts / declines</p>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search TXN ID, user, Razorpay Payment ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
          {['All', 'Paid', 'Pending', 'Failed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>TXN ID</th>
                <th>User Name</th>
                <th>Amount</th>
                <th>Water</th>
                <th>Payment Method</th>
                <th>Razorpay Payment ID</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No matching payment records found.
                  </td>
                </tr>
              ) : (
                filteredTxns.map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono font-bold text-sky-600">{txn.id}</td>
                    <td className="font-semibold text-slate-900">{txn.userName}</td>
                    <td className="font-bold text-slate-900">₹{txn.amount}</td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td className="text-slate-600">{txn.paymentMethod}</td>
                    <td className="font-mono text-xs text-slate-500">{txn.razorpayPaymentId}</td>
                    <td>
                      <Badge
                        variant={txn.paymentStatus === 'Paid' ? 'success' : txn.paymentStatus === 'Pending' ? 'warning' : 'danger'}
                      >
                        {txn.paymentStatus}
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
    </div>
  );
};

export default Payments;
