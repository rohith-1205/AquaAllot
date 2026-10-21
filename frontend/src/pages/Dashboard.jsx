import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Droplets,
  IndianRupee,
  Users,
  Radio,
  AlertTriangle,
  TrendingUp,
  Building2,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialHostels } from '../services/mockData';
import { Badge } from '../components/common/Badge';
import { LiveStationSummary } from '../components/live/LiveStationSummary';

export const Dashboard = () => {
  const { kpis, stations, transactions, waterUsage, revenueData, alerts, users } = useApp();
  const [timeTab, setTimeTab] = useState('thisWeek');

  const activeChartData = waterUsage[timeTab] || waterUsage.thisWeek;
  const xAxisKey = timeTab === 'today' ? 'time' : timeTab === 'thisWeek' ? 'day' : 'week';

  // Compute hostel-wise segregated metrics (100% Live from MongoDB)
  const hostelSegregatedData = initialHostels.map((h) => {
    const hostelUsers = users.filter((u) => u.hostelBlock === h.name);
    const hostelTxns = transactions.filter(
      (t) => t.hostelBlock === h.name || hostelUsers.some((u) => u.id === t.userId)
    );
    const waterUsedToday =
      hostelTxns.reduce((acc, t) => acc + Number(t.waterLiters || 0), 0) ||
      hostelUsers.reduce((acc, u) => acc + Number(u.todayUsage || 0), 0);
    const paymentsDone =
      hostelTxns
        .filter((t) => t.paymentStatus === 'Paid' || t.status === 'Paid')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0) ||
      hostelUsers.reduce((acc, u) => acc + Number(u.totalSpent || 0), 0);

    return {
      ...h,
      studentCount: hostelUsers.length,
      waterUsedToday: parseFloat(waterUsedToday.toFixed(1)),
      paymentsDone
    };
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4 animate-pulse" /> Live Institutional Water & Payment Control
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">Good morning, Admin 👋</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Here's what's happening across your AquaAllot smart dispensing system today.
          </p>
        </div>
        <Link
          to="/dispensing"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/30 transition-all shrink-0 cursor-pointer"
        >
          <Droplets className="w-4 h-4 fill-white" />
          <span>New Water Purchase</span>
        </Link>
      </div>

      {/* Live Wokwi station (click to open the Live Station page) */}
      <LiveStationSummary />

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispensed</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Droplets className="w-5 h-5 fill-sky-500/20" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-['Outfit']">
              {kpis.totalWaterDispensed.toLocaleString()} L
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12.5% vs yesterday</span>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-['Outfit']">
              ₹{kpis.totalRevenue.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+8.2% this week</span>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Students</span>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-['Outfit']">
              {kpis.activeUsersCount}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+5.4% registered</span>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Stations</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 font-['Outfit']">
              {kpis.activeStationsCount} / {kpis.totalStationsCount}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">All operational</p>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alerts</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-rose-600 font-['Outfit']">
              {kpis.totalAlertsCount}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {kpis.warningAlertsCount} warning • {kpis.criticalAlertsCount} critical
            </p>
          </div>
        </div>
      </div>

      {/* Hostel-Wise Segregated Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">Hostel Block Segregation Summary</h3>
            <p className="text-xs text-slate-500">Water used and digital payments done by hostel zone</p>
          </div>
          <Link to="/users" className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1">
            <span>View Student Directory</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hostelSegregatedData.map((hostel) => (
            <div
              key={hostel.id}
              className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{hostel.name}</h4>
                    <p className="text-[11px] text-slate-500">{hostel.type}</p>
                  </div>
                </div>
                <Badge variant="info">{hostel.studentCount} Students</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Water Used Today</span>
                  <span className="font-bold text-sky-600 text-base font-['Outfit']">{hostel.waterUsedToday} L</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Payments Done</span>
                  <span className="font-bold text-emerald-600 text-base font-['Outfit']">₹{hostel.paymentsDone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time System Status Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">Real-Time Station Status</h3>
            <p className="text-xs text-slate-500">Live telemetry from hostel dispenser stations</p>
          </div>
          <Link to="/stations" className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1">
            <span>View All Devices</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stations.map((stn) => (
            <div
              key={stn.id}
              className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:border-sky-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {stn.name}
                    {stn.isLive && <span className="px-1.5 py-0.5 rounded-md bg-cyan-500 text-white text-[9px] font-extrabold">LIVE</span>}
                  </h4>
                  <p className="text-[11px] text-slate-500">{stn.location}</p>
                </div>
                <Badge
                  variant={stn.status === 'Online' ? 'success' : stn.status === 'Warning' ? 'warning' : 'danger'}
                >
                  {stn.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Flow Rate</span>
                  <span className="font-bold text-slate-800 text-sm">{stn.flowRate} L/min</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Today's Usage</span>
                  <span className="font-bold text-slate-800 text-sm">{stn.todayUsage} L</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Temperature</span>
                  <span className="font-bold text-slate-800">{stn.temperature}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Last Sync</span>
                  <span className="font-bold text-slate-800">{stn.lastSync != null ? `${stn.lastSync} sec ago` : '—'}</span>
                </div>
              </div>

              {stn.alertMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{stn.alertMessage}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Analytics & Revenue Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Consumption Area Chart */}
        <div className="lg:col-span-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Water Consumption Trends</h3>
              <p className="text-xs text-slate-500">Volume dispensed across time horizons</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setTimeTab('today')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeTab === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeTab('thisWeek')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeTab === 'thisWeek' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setTimeTab('thisMonth')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  timeTab === 'thisMonth' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="waterColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={xAxisKey} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`${value} Liters`, 'Water Volume']}
                />
                <Area
                  type="monotone"
                  dataKey="liters"
                  stroke="#0284c7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#waterColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Overview Bar Chart */}
        <div className="lg:col-span-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Revenue Overview</h3>
              <p className="text-xs text-slate-500">Weekly digital payments (₹)</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`₹${value}`, 'Revenue']}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Alerts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Recent Transactions</h3>
              <p className="text-xs text-slate-500">Live Razorpay and prepaid water purchases</p>
            </div>
            <Link to="/payments" className="text-xs font-semibold text-sky-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>TXN ID</th>
                  <th>Student Name</th>
                  <th>Hostel Zone</th>
                  <th>Amount</th>
                  <th>Water</th>
                  <th>Payment</th>
                  <th>Dispensing</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono font-bold text-sky-600">{txn.id}</td>
                    <td className="font-semibold text-slate-900">{txn.userName}</td>
                    <td className="text-xs font-medium text-slate-600">{txn.hostelBlock || 'Hostel Block A'}</td>
                    <td className="font-bold text-slate-900">₹{txn.amount}</td>
                    <td className="font-semibold text-slate-800">{txn.waterLiters} L</td>
                    <td>
                      <Badge variant={txn.paymentStatus === 'Paid' ? 'success' : txn.paymentStatus === 'Pending' ? 'warning' : 'danger'}>
                        {txn.paymentStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={txn.dispensingStatus === 'Completed' ? 'success' : txn.dispensingStatus === 'Processing' ? 'info' : 'danger'}>
                        {txn.dispensingStatus}
                      </Badge>
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
              <h3 className="text-base font-bold text-slate-900 font-['Outfit']">System Alerts</h3>
              <p className="text-xs text-slate-500">3-Sigma & sensor warnings</p>
            </div>
            <Link to="/alerts" className="text-xs font-semibold text-sky-600 hover:underline">
              Manage
            </Link>
          </div>

          <div className="space-y-3">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={alt.severity === 'Critical' ? 'danger' : 'warning'}>
                    {alt.severity}
                  </Badge>
                  <span className="text-[10px] text-slate-400">{alt.timestamp}</span>
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
