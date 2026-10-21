import React from 'react';
import { Droplet } from 'lucide-react';

export const Loader = ({ message = 'Loading AquaAllot Telemetry...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
        <Droplet className="w-5 h-5 text-sky-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-sky-500" />
      </div>
      <p className="text-xs font-semibold text-slate-600">{message}</p>
    </div>
  );
};
