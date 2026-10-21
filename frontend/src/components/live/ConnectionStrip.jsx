import React from 'react';
import { Server, Radio, Cpu, Wifi } from 'lucide-react';

// One coloured "pill" per link in the chain:  Dashboard → Backend → MQTT broker → Wokwi ESP32
const StatusPill = ({ icon: Icon, title, ok, okText, badText, detail }) => (
  <div
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-sm ${
      ok ? 'bg-emerald-400/15 border-emerald-300/40' : 'bg-rose-400/15 border-rose-300/40'
    }`}
  >
    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`}>
      <Icon className="w-5 h-5 text-white" />
      {ok && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-300 animate-ping" />}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-white/70">{title}</p>
      <p className="text-sm font-bold text-white">{ok ? okText : badText}</p>
      {detail && <p className="text-[11px] text-white/70 truncate">{detail}</p>}
    </div>
  </div>
);

export const ConnectionStrip = ({ backendOnline, mqtt, station }) => {
  const espOnline = Boolean(station?.online);
  const espDetail = espOnline
    ? `fw ${station.firmware || '?'} · ${station.rssi ?? '?'} dBm · ${station.secondsSinceSeen ?? 0}s ago`
    : 'Start the simulation on wokwi.com';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusPill
        icon={Server}
        title="Backend"
        ok={Boolean(backendOnline)}
        okText="Running"
        badText="Not reachable"
        detail={backendOnline ? 'localhost:5000' : 'cd backend → npm run dev'}
      />
      <StatusPill
        icon={Radio}
        title="MQTT broker"
        ok={Boolean(mqtt?.connected)}
        okText="Connected"
        badText={mqtt?.enabled === false ? 'Disabled' : 'Connecting…'}
        detail={
          !mqtt ? '—' : mqtt.connected ? `${mqtt.broker}:${mqtt.port} · ${mqtt.transport}` : mqtt.error || `trying ${mqtt.broker}:${mqtt.port}`
        }
      />
      <StatusPill
        icon={espOnline ? Cpu : Wifi}
        title="Wokwi ESP32"
        ok={espOnline}
        okText="Online"
        badText="Offline"
        detail={espDetail}
      />
    </div>
  );
};
