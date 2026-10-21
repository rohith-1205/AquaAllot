import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';

/**
 * "Over-usage today" – one bar per student:
 *   today's litres compared with their normal limit (average + 3 × std-dev, learned
 *   from their own history) and the daily quota. Red = above normal or over quota.
 */
export const OverUsagePanel = ({ rows = [] }) => {
  const flagged = rows.filter((row) => row.aboveNormal || row.overQuota);

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
            <ShieldAlert className={`w-5 h-5 ${flagged.length ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
            Over-usage today
          </h3>
          <p className="text-xs text-slate-500">Today vs each student's normal limit (3-sigma) and daily quota</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold ${
            flagged.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {flagged.length ? `${flagged.length} flagged` : 'All normal'}
        </span>
      </div>

      <div className="space-y-3">
        {rows.slice(0, 6).map((row) => {
          const width = Math.min(100, row.percentOfLimit);
          const bad = row.aboveNormal || row.overQuota;
          return (
            <Link key={row.userId} to={`/users/${row.userId}`} className="block group">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-bold text-slate-800 group-hover:text-sky-600">
                  <img src={row.avatar} alt="" className="w-6 h-6 rounded-full bg-slate-100" />
                  {row.name}
                  {row.aboveNormal && <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px]">ABOVE NORMAL</span>}
                  {row.overQuota && <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px]">OVER QUOTA</span>}
                </span>
                <span className={`font-mono font-bold ${bad ? 'text-rose-600' : 'text-slate-500'}`}>
                  {row.todayUsage} / {row.limit} L
                </span>
              </div>
              <div className="h-2.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${
                    bad ? 'from-rose-500 to-orange-400' : width > 70 ? 'from-amber-400 to-yellow-300' : 'from-sky-500 to-cyan-300'
                  }`}
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                normal {row.mean} L/day · quota {row.quota} L {row.learned ? `· learned from ${row.historyDays} days` : '· starting values'}
              </p>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No usage yet today.
          </p>
        )}
      </div>

      <Link to="/alerts" className="text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1">
        See all alerts <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
