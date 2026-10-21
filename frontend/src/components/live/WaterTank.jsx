import React from 'react';
import { Gauge, Droplets } from 'lucide-react';

// Animated tank that fills up while the ESP32 reports litres
export const WaterTank = ({ dispensed = 0, target = 0, flowLpm = 0, valve = 'Closed', state }) => {
  const percent = target > 0 ? Math.min(100, Math.round((dispensed / target) * 100)) : 0;
  const flowing = state === 'DISPENSING' && valve === 'Open';
  const fillColor =
    state === 'ALERT' ? 'from-rose-500 to-rose-300' : percent >= 100 ? 'from-emerald-500 to-teal-300' : 'from-sky-600 to-cyan-300';

  return (
    <div className="flex items-end gap-5">
      {/* Tank */}
      <div className="relative w-32 h-48 rounded-[2rem] border-4 border-sky-200 bg-gradient-to-b from-slate-50 to-sky-50 overflow-hidden shadow-inner shrink-0">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fillColor} transition-all duration-700 ease-out`}
          style={{ height: `${percent}%` }}
        >
          {/* wave on the water surface */}
          {percent > 0 && percent < 100 && (
            <svg className="absolute -top-3 left-0 w-[200%] h-4 water-wave" viewBox="0 0 200 10" preserveAspectRatio="none">
              <path d="M0 5 Q 12.5 0 25 5 T 50 5 T 75 5 T 100 5 T 125 5 T 150 5 T 175 5 T 200 5 V10 H0 Z" fill="rgba(103,232,249,0.9)" />
            </svg>
          )}
          {flowing &&
            [15, 45, 75].map((left, i) => (
              <span
                key={left}
                className="bubble absolute bottom-1 w-2 h-2 rounded-full bg-white/70"
                style={{ left: `${left}%`, animationDelay: `${i * 0.6}s` }}
              />
            ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold font-['Outfit'] text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
            {percent}%
          </span>
          <span className="text-[11px] font-bold text-slate-600">
            {dispensed.toFixed(2)} / {target || 0} L
          </span>
        </div>
      </div>

      {/* Readings */}
      <div className="space-y-3 flex-1 min-w-0">
        <Reading icon={Droplets} label="Dispensed" value={`${dispensed.toFixed(2)} L`} color="text-sky-600" />
        <Reading icon={Gauge} label="Flow rate" value={`${flowLpm.toFixed(1)} L/min`} color="text-violet-600" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Valve</span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              valve === 'Open' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {valve === 'Open' ? '● OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>
    </div>
  );
};

const Reading = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-extrabold font-['Outfit'] ${color}`}>{value}</p>
    </div>
  </div>
);
