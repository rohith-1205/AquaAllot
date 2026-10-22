import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Gauge, Save, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Set ONE student's daily water limit.
 *   • type a number + Save  → personal limit for this student
 *   • "Default"            → back to the default limit from Settings
 * The backend checks it before every order (Wokwi or dashboard).
 */
export const DailyLimitEditor = ({ user, compact = false }) => {
  const { settings, setUserLimit } = useApp();
  const defaultLimit = settings.dailyLimitLiters;
  const hasPersonal = Boolean(user.dailyLimit);
  const current = hasPersonal ? user.dailyLimit : defaultLimit;

  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(current), [current]);

  const save = async (limit) => {
    setSaving(true);
    try {
      await setUserLimit(user.id, limit);
      toast.success(limit ? `${user.name}: ${limit} L per day` : `${user.name} now uses the default ${defaultLimit} L`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changed = Number(value) !== Number(current);
  const used = Number(user.todayUsage || 0);
  const percent = current ? Math.min(100, (used / current) * 100) : 0;
  const bar = percent >= 100 ? 'from-rose-500 to-orange-400' : percent >= 70 ? 'from-amber-400 to-yellow-300' : 'from-sky-500 to-cyan-300';

  return (
    <div className={compact ? 'min-w-[170px] space-y-1.5' : 'space-y-3'}>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${compact ? 'w-20 py-1 text-xs' : 'w-28 py-2 text-sm'} pl-2.5 pr-6 font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">L</span>
        </div>
        <button
          type="button"
          onClick={() => save(Number(value))}
          disabled={!changed || saving || !(Number(value) > 0)}
          title="Save personal limit"
          className="p-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        {hasPersonal && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving}
            title={`Use the default limit (${defaultLimit} L)`}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 flex items-center gap-1">
        <Gauge className="w-3 h-3 text-violet-500" />
        {used} / {current} L today ·{' '}
        <span className={`font-bold ${hasPersonal ? 'text-violet-600' : 'text-slate-400'}`}>{hasPersonal ? 'personal' : 'default'}</span>
      </p>
    </div>
  );
};
