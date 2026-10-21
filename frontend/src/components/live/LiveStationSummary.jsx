import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, ChevronRight, Droplets } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { STATE_STYLE } from '../../services/wokwiCards';

// Small live card for the main Dashboard. Click it to open the Live Station page.
export const LiveStationSummary = () => {
  const { liveStation: station } = useApp();
  const state = station?.state || 'OFFLINE';
  const style = STATE_STYLE[state] || STATE_STYLE.OFFLINE;
  const target = Number(station?.order?.liters || station?.target || 0);
  const dispensed = Number(station?.dispensed || 0);
  const percent = target > 0 ? Math.min(100, Math.round((dispensed / target) * 100)) : 0;

  return (
    <Link
      to="/live"
      className="block p-5 rounded-3xl text-white shadow-xl bg-gradient-to-r from-indigo-700 via-sky-600 to-cyan-500 hover:shadow-2xl hover:shadow-sky-500/30 transition-shadow"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
            {station?.online && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-100">Live Wokwi station · STN-001</p>
            <p className="text-lg font-extrabold font-['Outfit'] truncate">
              {station?.user ? `${station.user.name} is at the tap` : station?.online ? 'Ready for the next card' : 'Waiting for the Wokwi simulation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${style.chip}`}>{style.label}</span>
          {target > 0 && (
            <div className="w-40">
              <div className="flex justify-between text-[11px] font-bold text-cyan-50">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5" /> {dispensed.toFixed(2)} L
                </span>
                <span>{target} L</span>
              </div>
              <div className="h-2.5 mt-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 to-white transition-all duration-700" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
          <ChevronRight className="w-5 h-5 text-cyan-100" />
        </div>
      </div>
    </Link>
  );
};
