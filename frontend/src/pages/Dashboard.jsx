import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Droplets,
  IndianRupee,
  Users,
  Radio,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Building2,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { LiveStationSummary } from '../components/live/LiveStationSummary';
import { OverUsagePanel } from '../components/dashboard/OverUsagePanel';
import { formatDateTime, timeAgo, rupees, percentText } from '../utils/format';

const CHART_TABS = [
  { key: 'today', label: 'Today', xKey: 'time' },
  { key: 'thisWeek', label: 'This Week', xKey: 'day' },
  { key: 'thisMonth', label: 'Last 4 Weeks', xKey: 'week' }
];

const tooltipStyle = { backgroundColor: '#0f172a', border: 'none', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' };

// Small coloured "trend" line under a KPI number. Green = up, red = down.
const Trend = ({ value, suffix }) => {
  if (value === null || value === undefined) return <span className="text-xs font-semibold text-slate-400">No data to compare</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="w-3.5 h-3.5" /> {percentText(value)} {suffix}
    </span>
  );
};

const KpiCard = ({ title, value, icon: Icon, color, children }) => (
  <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      <div className={`p-2 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <h3 className="mt-3 text-2xl font-black text-slate-900 font-['Outfit']">{value}</h3>
    <div className="mt-1">{children}</div>
  </div>
);

export const Dashboard = () => {
  // Every number here comes from GET /api/analytics (calculated from real transactions)
  const { kpis, analytics, transactions, alerts } = useApp();
  const [timeTab, setTimeTab] = useState('thisWeek');
  const tab = CHART_TABS.find((t) => t.key === timeTab);
  const openAlerts = alerts.filter((a) => a.status === 'Unresolved');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4 animate-pulse" /> Live Institutional Water & Payment Control
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">Hello, Admin 👋</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">Here's what's happening across your AquaAllot stations today.</p>
        </div>
        <Link
          to="/dispensing"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/30 transition-all shrink-0"
        >
          <Droplets className="w-4 h-4 fill-white" />
          <span>New Water Order</span>
        </Link>
      </div>

      {/* Live Wokwi station (click to open the Live Station page) */}
      <LiveStationSummary />

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Dispensed today" value={`${kpis.dispensedToday} L`} icon={Droplets} color="bg-sky-50 text-sky-600">
          <Trend value={kpis.dispensedChangePct} suffix="vs yesterday" />
        </KpiCard>
        <KpiCard title="Revenue (7 days)" value={rupees(kpis.revenueWeek)} icon={IndianRupee} color="bg-emerald-50 text-emerald-600">
          <Trend value={kpis.revenueChangePct} suffix="vs last week" />
        </KpiCard>
        <KpiCard title="Active students" value={kpis.activeStudents} icon={Users} color="bg-indigo-50 text-indigo-600">
          <span className="text-xs font-bold text-indigo-600">
            {kpis.newStudentsWeek ? `+${kpis.newStudentsWeek} registered this week` : `${kpis.totalStudents} registered`}
          </span>
        </KpiCard>
        <KpiCard
          title="Live stations"
          value={`${kpis.liveStationsOnline ?? 0} / ${kpis.liveStationsTotal ?? 1}`}
          icon={Radio}
          color="bg-cyan-50 text-cyan-600"
        >
          <span className={`text-xs font-bold ${kpis.liveStationsOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpis.liveStationsOnline ? 'Wokwi station online' : 'Start the Wokwi simulation'}
          </span>
        </KpiCard>
        <KpiCard title="Open alerts" value={kpis.totalAlertsCount} icon={AlertTriangle} color="bg-rose-50 text-rose-600">
          <span className="text-xs font-bold text-slate-500">
            {kpis.criticalAlertsCount} critical · {kpis.overUsageToday} at daily limit
          </span>
        </KpiCard>
      </div>

      {/* Over-usage + hostel summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <OverUsagePanel rows={analytics.overuse} />
        </div>
        <div className="lg:col-span-5 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Hostel blocks today</h3>
            <p className="text-xs text-slate-500">Water and payments per block (today only)</p>
          </div>
          {analytics.hostels.map((hostel) => (
            <div key={hostel.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{hostel.name}</p>
                  <p className="text-[11px] text-slate-500">{hostel.studentCount} students</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-sky-600 font-['Outfit']">{hostel.waterUsedToday} L</p>
                <p className="text-[11px] font-bold text-emerald-600">{rupees(hostel.paymentsToday)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Water consumption</h3>
              <p className="text-xs text-slate-500">Litres dispensed, from real transactions</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              {CHART_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTimeTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    timeTab === t.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.charts[timeTab]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="waterColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={tab.xKey} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} L`, 'Water']} />
                <Area isAnimationActive={false} type="monotone" dataKey="liters" stroke="#0284c7" strokeWidth={3} fill="url(#waterColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Revenue (last 7 days)</h3>
              <p className="text-xs text-slate-500">Razorpay payments for water, after refunds (₹)</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [rupees(value), 'Revenue']} />
                <Bar isAnimationActive={false} dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Recent transactions</h3>
              <p className="text-xs text-slate-500">Water orders paid with Razorpay</p>
            </div>
            <Link to="/payments" className="text-xs font-semibold text-sky-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Water</th>
                  <th>Charged</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 6).map((txn) => (
                  <tr key={txn.id}>
                    <td>
                      <span className="font-semibold text-slate-900 block">{txn.userName}</span>
                      <span className="text-[10px] font-mono text-sky-600">{txn.id}</span>
                    </td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td className="font-bold text-slate-900">
                      {rupees(txn.amount)}
                      {txn.refund > 0 && <span className="block text-[10px] text-violet-500">+{rupees(txn.refund)} refunded</span>}
                    </td>
                    <td>
                      <Badge variant={txn.dispensingStatus === 'Completed' ? 'success' : txn.dispensingStatus === 'Dispensing' ? 'info' : 'danger'}>
                        {txn.dispensingStatus}
                      </Badge>
                    </td>
                    <td className="text-xs text-slate-500" title={formatDateTime(txn.timestamp)}>
                      {timeAgo(txn.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Open alerts</h3>
              <p className="text-xs text-slate-500">Over-usage, refunds & sensor warnings</p>
            </div>
            <Link to="/alerts" className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1">
              Manage <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {openAlerts.length === 0 && <p className="text-xs text-slate-400">No open alerts 🎉</p>}
            {openAlerts.slice(0, 5).map((alt) => (
              <div key={alt.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={alt.severity === 'Critical' ? 'danger' : 'warning'}>{alt.severity}</Badge>
                  <span className="text-[10px] text-slate-400">{timeAgo(alt.timestamp)}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">{alt.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{alt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
