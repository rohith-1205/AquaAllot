import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Download, Undo2, Droplets, CreditCard, ListChecks } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { formatDateTime, rupees } from '../utils/format';

const STATUS_TABS = ['All', 'Paid', 'Partly refunded', 'Refunded'];

const statusVariant = (status) =>
  status === 'Paid' ? 'success' : status === 'Partly refunded' ? 'info' : status === 'Refunded' ? 'warning' : 'danger';

// Turns rows into a CSV file and downloads it
const downloadCsv = (rows) => {
  const header = ['Transaction', 'Student', 'Litres', 'Charged (Rs)', 'Refunded (Rs)', 'Method', 'Payment', 'Dispensing', 'Station', 'Time'];
  const lines = rows.map((t) =>
    [t.id, t.userName, t.waterLiters, t.amount, t.refund || 0, t.paymentMethod, t.paymentStatus, t.dispensingStatus, t.stationId, t.timestamp]
      .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `aquaallot-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const Payments = () => {
  const { transactions, kpis } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [visibleRows, setVisibleRows] = useState(50); // long lists: show 50 at a time

  const query = searchQuery.toLowerCase();
  const filteredTxns = transactions.filter((t) => {
    const text = [t.id, t.userName, t.rfid, t.orderId, t.paymentMethod].filter(Boolean).join(' ').toLowerCase();
    const matchesStatus = statusFilter === 'All' || t.paymentStatus === statusFilter;
    return text.includes(query) && matchesStatus;
  });

  const totalRefunded = transactions.reduce((sum, t) => sum + Number(t.refund || 0), 0);
  const razorpayPayments = transactions.filter((t) => t.razorpayPaymentId);
  const refunds = transactions.filter((t) => Number(t.refund) > 0);

  const handleExportCSV = () => {
    downloadCsv(filteredTxns);
    toast.success(`Exported ${filteredTxns.length} transactions`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">Razorpay Payments & Refunds</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every order is paid with Razorpay (signature verified by the backend). Unused litres are refunded automatically.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" icon={Download}>
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Revenue today', value: rupees(kpis.revenueToday), note: `${rupees(kpis.revenueWeek)} in the last 7 days`, icon: Droplets, color: 'text-sky-600 bg-sky-50' },
          { title: 'Razorpay payments', value: razorpayPayments.length, note: 'Verified by the backend', icon: CreditCard, color: 'text-indigo-600 bg-indigo-50' },
          { title: 'Refunded via Razorpay', value: rupees(totalRefunded), note: `${refunds.length} refunds (unused litres + failed orders)`, icon: Undo2, color: 'text-violet-600 bg-violet-50' },
          { title: 'Transactions shown', value: filteredTxns.length, note: 'Newest 200 from the backend', icon: ListChecks, color: 'text-emerald-600 bg-emerald-50' }
        ].map((card) => (
          <div key={card.title} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</span>
              <div className={`p-2 rounded-xl ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{card.value}</h3>
            <p className="text-xs text-slate-500 mt-1">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Search & filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transaction, student, card, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === tab ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Student</th>
                <th>Water</th>
                <th>Charged</th>
                <th>Method</th>
                <th>Payment</th>
                <th>Dispensing</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No matching transactions.
                  </td>
                </tr>
              ) : (
                filteredTxns.slice(0, visibleRows).map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono font-bold text-sky-600 text-xs">
                      {txn.id}
                      {txn.orderId && <span className="block text-[10px] text-slate-400">{txn.orderId}</span>}
                    </td>
                    <td className="font-semibold text-slate-900">{txn.userName}</td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td className="font-bold text-slate-900">
                      {rupees(txn.amount)}
                      {txn.refund > 0 && <span className="block text-[10px] text-violet-500">+{rupees(txn.refund)} refunded</span>}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {txn.paymentMethod}
                      {txn.razorpayPaymentId && <span className="block text-[10px] font-mono text-slate-400">{txn.razorpayPaymentId}</span>}
                    </td>
                    <td>
                      <Badge variant={statusVariant(txn.paymentStatus)}>{txn.paymentStatus}</Badge>
                    </td>
                    <td className="text-xs text-slate-600">{txn.dispensingStatus}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(txn.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredTxns.length > visibleRows && (
          <button
            onClick={() => setVisibleRows((n) => n + 50)}
            className="w-full py-3 text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 cursor-pointer"
          >
            Show more ({filteredTxns.length - visibleRows} more)
          </button>
        )}
      </div>

      {/* Refunds */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
          <Undo2 className="w-5 h-5 text-violet-500" /> Razorpay refunds
        </h3>
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Student</th>
                <th>Refund</th>
                <th>Why</th>
                <th>Status</th>
                <th>Razorpay refund</th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    No refunds yet. They appear when an order is stopped early or never dispenses.
                  </td>
                </tr>
              ) : (
                refunds.map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono font-bold text-violet-600 text-xs">{txn.id}</td>
                    <td className="font-semibold text-slate-900">{txn.userName}</td>
                    <td className="font-bold text-violet-600">{rupees(txn.refund)}</td>
                    <td className="text-xs text-slate-600">{txn.refundReason || txn.dispensingStatus}</td>
                    <td>
                      <Badge variant={txn.refundStatus === 'processed' ? 'success' : txn.refundStatus === 'failed' ? 'danger' : 'warning'}>
                        {txn.refundStatus === 'processed' ? 'Sent' : txn.refundStatus === 'failed' ? 'Failed – do it manually' : 'Sending…'}
                      </Badge>
                    </td>
                    <td className="font-mono text-[11px] text-slate-500">{txn.refundId || txn.refundError || '—'}</td>
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
