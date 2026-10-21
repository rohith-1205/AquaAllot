import React from 'react';
import { Cpu, User, Wallet, AlertTriangle, RotateCcw, ExternalLink, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { STATE_STYLE } from '../services/wokwiCards';
import { ConnectionStrip } from '../components/live/ConnectionStrip';
import { StepTracker } from '../components/live/StepTracker';
import { WaterTank } from '../components/live/WaterTank';
import { PaymentPanel } from '../components/live/PaymentPanel';
import { ControlPanel } from '../components/live/ControlPanel';
import { EventLog } from '../components/live/EventLog';

/**
 * LIVE STATION – the Wokwi ESP32 in real time.
 *
 *   Wokwi ESP32  ⇄  MQTT broker  ⇄  backend (npm run dev)  ⇄  this page (polls /api/live every second)
 */
export const LiveStation = () => {
  const { liveStation: station, liveEvents, mqttStatus, backendOnline, sendStationCommand } = useApp();
  const state = station?.state || 'OFFLINE';
  const style = STATE_STYLE[state] || STATE_STYLE.OFFLINE;

  const resetStation = async () => {
    try {
      await sendStationCommand('reset');
      toast.success('Station reset');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ---------- Hero header ---------- */}
      <div className="relative overflow-hidden p-6 rounded-3xl text-white shadow-xl bg-gradient-to-br from-indigo-700 via-sky-600 to-cyan-500">
        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-24 -bottom-16 w-48 h-48 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-cyan-100 text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4" /> Station STN-001 · Wokwi ESP32
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">Live Station</h2>
              <p className="text-xs sm:text-sm text-sky-100">
                Everything you do in the Wokwi simulation shows up here within a second.
              </p>
            </div>
            <span className={`self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-extrabold ${style.chip}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot} ${state !== 'OFFLINE' ? 'animate-pulse' : ''}`} />
              {style.label}
            </span>
          </div>
          <ConnectionStrip backendOnline={backendOnline} mqtt={mqttStatus} station={station} />
        </div>
      </div>

      {/* ---------- Not connected yet: show the setup steps ---------- */}
      {!station?.online && <SetupGuide backendOnline={backendOnline} mqtt={mqttStatus} />}

      {/* ---------- Order steps ---------- */}
      <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <StepTracker state={state} />
      </div>

      {/* ---------- Alert banner ---------- */}
      {station?.alert && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-extrabold">Valve closed – anomaly detected</p>
              <p className="text-xs text-rose-100">{station.alert}</p>
            </div>
          </div>
          <button
            onClick={resetStation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-rose-600 text-xs font-bold hover:bg-rose-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Acknowledge & reset
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ---------- Left: what is happening at the tap ---------- */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <CustomerCard station={station} />
            <WaterTank
              dispensed={Number(station?.dispensed || 0)}
              target={Number(station?.order?.liters || station?.target || 0)}
              flowLpm={Number(station?.flowLpm || 0)}
              valve={station?.valve}
              state={state}
            />
          </div>

          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Payment</h3>
            <PaymentPanel station={station} />
          </div>
        </div>

        {/* ---------- Right: controls + live messages ---------- */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" /> Control panel
            </h3>
            <ControlPanel station={station} />
          </div>
          <EventLog events={liveEvents} />
        </div>
      </div>
    </div>
  );
};

// The student currently at the tap
const CustomerCard = ({ station }) => {
  const user = station?.user;
  if (!user) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center">
          <User className="w-7 h-7 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">Nobody at the tap</p>
          <p className="text-xs text-slate-500">
            {station?.lastCard ? `Last card: ${station.lastCard}` : 'Tap a card on the Wokwi RFID reader'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100">
      <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl bg-white border-2 border-white shadow" />
      <div className="flex-1 min-w-0">
        <p className="text-lg font-extrabold text-slate-900 font-['Outfit'] truncate">{user.name}</p>
        <p className="text-xs text-slate-500">
          {user.hostelBlock} · card <span className="font-mono">{user.rfid}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 justify-end">
          <Wallet className="w-3 h-3" /> Wallet
        </p>
        <p className="text-xl font-extrabold text-emerald-600 font-['Outfit']">₹{Number(user.balance).toFixed(0)}</p>
      </div>
    </div>
  );
};

// Shown until the ESP32 is online
const SetupGuide = ({ backendOnline, mqtt }) => {
  const steps = [
    { done: backendOnline, text: 'Start the backend:  cd backend  →  npm run dev' },
    { done: mqtt?.connected, text: `Backend connects to the MQTT broker (${mqtt?.broker || 'test.mosquitto.org'})` },
    { done: false, text: 'Open wokwi.com → new ESP32 project → paste sketch.ino, diagram.json, libraries.txt' },
    { done: false, text: 'Press ▶ in Wokwi and wait for “Cloud: ONLINE” on the OLED' }
  ];
  return (
    <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-amber-900">Connect the Wokwi simulation</h3>
        <a
          href="https://wokwi.com/projects/new/esp32"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline"
        >
          Open Wokwi <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-amber-900">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step.done ? 'bg-emerald-500 text-white' : 'bg-amber-200 text-amber-800'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </span>
            {step.text}
          </li>
        ))}
      </ol>
      {mqtt?.topicRoot && (
        <p className="text-[11px] text-amber-800">
          Topic must match <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono">TOPIC_ROOT = "{mqtt.topicRoot}"</code> in sketch.ino
        </p>
      )}
    </div>
  );
};
