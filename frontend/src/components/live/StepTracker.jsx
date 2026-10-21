import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { STATION_STEPS } from '../../services/wokwiCards';

// Shows where the station is in the order flow:  Tap card → Choose litres → Pay → Dispensing → Done
export const StepTracker = ({ state }) => {
  const stepState = state === 'CHECKING' ? 'IDLE' : state;
  const currentIndex = STATION_STEPS.findIndex((s) => s.state === stepState);
  const isAlert = state === 'ALERT';

  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {STATION_STEPS.map((step, index) => {
        const done = currentIndex > index;
        const active = currentIndex === index;
        return (
          <React.Fragment key={step.state}>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30 scale-105'
                  : done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    active ? 'bg-white/30' : 'bg-slate-200'
                  }`}
                >
                  {index + 1}
                </span>
              )}
              {step.label}
            </div>
            {index < STATION_STEPS.length - 1 && (
              <div className={`h-0.5 w-4 sm:w-8 shrink-0 rounded ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
      {isAlert && (
        <div className="ml-2 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white animate-pulse whitespace-nowrap">
          ⚠ ALERT
        </div>
      )}
    </div>
  );
};
