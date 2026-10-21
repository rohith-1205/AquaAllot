import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Server, Terminal } from 'lucide-react';

// Each MQTT message in plain words, newest on top.
const DIRECTION = {
  up: { icon: ArrowUpRight, tag: 'ESP32 → Cloud', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  down: { icon: ArrowDownLeft, tag: 'Cloud → ESP32', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  system: { icon: Server, tag: 'Backend', color: 'text-violet-300', bg: 'bg-violet-400/10' }
};

export const EventLog = ({ events = [] }) => (
  <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
      <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
        <Terminal className="w-4 h-4 text-cyan-400" /> Live MQTT messages
      </span>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> live
      </span>
    </div>
    <div className="max-h-80 overflow-y-auto p-2 space-y-1 font-mono">
      {events.length === 0 && (
        <p className="p-4 text-center text-xs text-slate-500">Nothing yet – start the Wokwi simulation and tap a card.</p>
      )}
      {events.map((event, index) => {
        const style = DIRECTION[event.direction] || DIRECTION.system;
        const Icon = style.icon;
        return (
          <div key={`${event.ts}-${index}`} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg ${style.bg}`}>
            <span className="text-[10px] text-slate-500 pt-0.5 shrink-0">{event.time}</span>
            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.color}`} />
            <div className="min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider ${style.color}`}>
                {style.tag} · {event.type}
              </span>
              <p className="text-[11px] text-slate-200 break-words">{event.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
