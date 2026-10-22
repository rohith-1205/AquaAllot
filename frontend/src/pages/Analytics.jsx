import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { rupees } from '../utils/format';

const HORIZONS = [
  { key: 'today', label: 'Today', xKey: 'time' },
  { key: 'thisWeek', label: 'Weekly', xKey: 'day' },
  { key: 'thisMonth', label: '4 Weeks', xKey: 'week' }
];

const StatCard = ({ title, value, note, color = 'text-slate-900' }) => (
  <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
    <h3 className={`text-2xl font-black font-['Outfit'] mt-2 ${color}`}>{value}</h3>
    <p className="text-xs text-slate-500 mt-1">{note}</p>
  </div>
);

export const Analytics = () => {
  // All charts come from GET /api/analytics (calculated from the stored transactions)
  const { analytics } = useApp();
  const [horizon, setHorizon] = useState('thisWeek');
  const current = HORIZONS.find((h) => h.key === horizon);

  const week = analytics.charts.thisWeek;
  const weekLiters = week.reduce((sum, day) => sum + day.liters, 0);
  const busiestHour = [...analytics.charts.today].sort((a, b) => b.liters - a.liters)[0];
  const atLimit = analytics.overuse.filter((row) => row.reachedLimit || row.triedOverLimit).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">Consumption Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every number here is calculated from real transactions.</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          {HORIZONS.map((h) => (
            <button
              key={h.key}
              onClick={() => setHorizon(h.key)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                horizon === h.key ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Water (last 7 days)" value={`${weekLiters.toFixed(1)} L`} note={`${(weekLiters / 7).toFixed(1)} L per day on average`} />
        <StatCard title="Students at their limit" value={atLimit} note="Limits are set by the admin (Settings / Users)" color={atLimit ? 'text-rose-600' : 'text-violet-600'} />
        <StatCard
          title="Busiest time today"
          value={busiestHour && busiestHour.liters > 0 ? `${busiestHour.time}–${String(Number(busiestHour.time.slice(0, 2)) + 2).padStart(2, '0')}:00` : '—'}
          note={busiestHour && busiestHour.liters > 0 ? `${busiestHour.liters} L dispensed` : 'No water dispensed yet today'}
          color="text-sky-600"
        />
        <StatCard title="Revenue (last 7 days)" value={rupees(analytics.kpis.revenueWeek)} note={`${rupees(analytics.kpis.revenueToday)} today`} color="text-emerald-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Water allocation over time</h3>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.charts[horizon]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={current.xKey} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
                <Tooltip formatter={(val) => [`${val} L`, 'Dispensed']} />
                <Area isAnimationActive={false} type="monotone" dataKey="liters" stroke="#7c3aed" strokeWidth={3} fill="url(#analyticsWater)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Station load (last 7 days)</h3>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.stations} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="id" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} unit="L" />
                <Tooltip formatter={(val) => [`${val} L`, 'Last 7 days']} labelFormatter={(id, rows) => rows?.[0]?.payload?.name || id} />
                <Bar isAnimationActive={false} dataKey="litersWeek" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Students today */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Students today vs their daily limit</h3>
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Today</th>
                <th>Daily limit</th>
                <th>Left today</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.overuse.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <img src={row.avatar} alt="" className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50" />
                      <span className="font-bold text-slate-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="font-bold text-sky-600">{row.todayUsage} L</td>
                  <td className="text-slate-600">
                    {row.limit} L{' '}
                    <span className={`text-[10px] ${row.customLimit ? 'text-violet-600 font-bold' : 'text-slate-400'}`}>
                      ({row.customLimit ? 'personal' : 'default'})
                    </span>
                  </td>
                  <td className="text-slate-600">{row.left} L</td>
                  <td>
                    {row.reachedLimit || row.triedOverLimit ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
                        {row.reachedLimit ? 'Limit reached' : 'Asked for more'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">Within limit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
