import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Droplet, Radio, Scan, ShieldCheck, Maximize, ArrowLeft, Send, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { useStationOrder } from '../hooks/useStationOrder';
import { WaterTank } from '../components/live/WaterTank';
import { PaymentPanel } from '../components/live/PaymentPanel';
import { rupees } from '../utils/format';

const QUANTITIES = [1, 2, 5, 10];

/**
 * Full-screen kiosk for a phone/tablet next to the dispenser.
 * Student identifies (name or RFID UID) → chooses litres → order goes to the real
 * Wokwi station → pays from the wallet (or tops up with Razorpay) → watches the tank fill.
 */
export const KioskDispenser = () => {
  const { users, waterPricePerLiter } = useApp();
  const { station, online, stationIdle, order, phase, busy, startOrder, reset } = useStationOrder();

  const [selectionMode, setSelectionMode] = useState('select'); // 'select' | 'rfid'
  const [selectedUserId, setSelectedUserId] = useState('USR001');
  const [rfidInput, setRfidInput] = useState('');
  const [rfidUser, setRfidUser] = useState(null);
  const [liters, setLiters] = useState(2);

  const activeUsers = users.filter((u) => u.status !== 'Suspended' && u.status !== 'Inactive');
  const student = selectionMode === 'rfid' ? rfidUser : activeUsers.find((u) => u.id === selectedUserId) || activeUsers[0];
  const total = liters * waterPricePerLiter;

  const [clock, setClock] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRfidVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await api.verifyRfid(rfidInput.trim());
      setRfidUser(res.user);
      toast.success(`Card verified: ${res.user.name}`);
    } catch (err) {
      setRfidUser(null);
      toast.error(err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen?.();
  };

  const card = 'p-5 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-xl';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none overflow-x-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Droplet className="w-6 h-6 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight font-['Outfit'] text-white">AquaAllot Kiosk</h1>
            <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${online ? 'text-emerald-400' : 'text-rose-400'}`}>
              <Radio className="w-3 h-3 animate-pulse" /> {online ? 'Wokwi station online' : 'Station offline – start Wokwi'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-right mr-2">
            <div className="text-xs font-mono font-bold text-sky-400">{clock}</div>
            <div className="text-[10px] text-slate-500">{rupees(waterPricePerLiter)}/litre</div>
          </div>
          <button onClick={toggleFullscreen} className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 active:scale-95" title="Full screen">
            <Maximize className="w-4 h-4" />
          </button>
          <Link to="/dashboard" className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 active:scale-95 flex items-center gap-1 text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden md:inline">Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="my-6 max-w-lg mx-auto w-full space-y-5">
        {phase === 'select' ? (
          <>
            {/* 1. Student */}
            <div className={`${card} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 font-['Outfit']">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-black flex items-center justify-center">1</span>
                  Who are you?
                </h2>
                <div className="flex p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-semibold">
                  {['select', 'rfid'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectionMode(mode)}
                      className={`px-3 py-1 rounded-lg ${selectionMode === mode ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
                    >
                      {mode === 'select' ? 'Name' : 'RFID card'}
                    </button>
                  ))}
                </div>
              </div>

              {selectionMode === 'select' ? (
                <select
                  value={student?.id}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-slate-950 border border-slate-800 rounded-2xl text-white focus:outline-none focus:border-sky-500"
                >
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.hostelBlock}) · wallet {rupees(u.balance)}
                    </option>
                  ))}
                </select>
              ) : (
                <form onSubmit={handleRfidVerify} className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Scan className="w-4 h-4 text-sky-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="e.g. 01:02:03:04"
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-xs bg-slate-950 border border-slate-800 rounded-2xl text-white focus:outline-none focus:border-sky-500 uppercase font-mono"
                      />
                    </div>
                    <button type="submit" className="px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white active:scale-95">
                      Verify
                    </button>
                  </div>
                  {rfidUser && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" /> {rfidUser.name} · wallet {rupees(rfidUser.balance)}
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* 2. Litres */}
            <div className={`${card} space-y-4`}>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 font-['Outfit']">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-black flex items-center justify-center">2</span>
                How much water?
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {QUANTITIES.map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setLiters(qty)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      liters === qty ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 font-bold shadow-lg shadow-cyan-500/10' : 'border-slate-800 hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <Droplet className="w-5 h-5 mx-auto mb-1 text-cyan-400 fill-cyan-400/20" />
                    <span className="text-base font-extrabold block font-['Outfit']">{qty} L</span>
                    <span className="text-[10px] text-slate-400">{rupees(qty * waterPricePerLiter)}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Wallet</span>
                  <span className={`text-base font-bold ${student && student.balance >= total ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {student ? rupees(student.balance) : '—'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">To pay</span>
                  <span className="text-xl font-black text-cyan-300 font-['Outfit']">{rupees(total)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => startOrder(student.id, liters)}
              disabled={!student || !stationIdle || busy}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300 text-slate-950 font-black text-base shadow-xl shadow-cyan-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" /> SEND TO DISPENSER
            </button>
            {online && !stationIdle && <p className="text-center text-xs text-amber-400">The dispenser is busy – please wait a moment.</p>}
          </>
        ) : phase === 'lost' ? (
          <div className={`${card} text-center space-y-4`}>
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">The dispenser cancelled this order</h2>
            <p className="text-xs text-slate-400">No money was taken for an unpaid order.</p>
            <button onClick={reset} className="w-full py-3 rounded-2xl bg-slate-800 text-white font-bold text-sm active:scale-95">
              Start again
            </button>
          </div>
        ) : (
          <div className={`${card} space-y-5`}>
            <WaterTank
              dispensed={Number(phase === 'done' ? order.dispensedLiters : station?.dispensed || 0)}
              target={Number(order.liters)}
              flowLpm={Number(station?.flowLpm || 0)}
              valve={station?.valve}
              state={station?.state}
            />
            <PaymentPanel station={{ ...station, order }} dark />
            {phase === 'dispensing' && <p className="text-xs text-slate-400 italic text-center">Hold your bottle under the nozzle…</p>}
            {phase === 'done' && (
              <>
                <p className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" /> Done – thank you!
                </p>
                <button onClick={reset} className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm active:scale-95 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Next student
                </button>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="p-3 text-center text-[10px] text-slate-500 border-t border-slate-900">
        AquaAllot kiosk · STN-001 (Wokwi) · prepaid wallet · Razorpay top-ups verified by the backend
      </footer>
    </div>
  );
};

export default KioskDispenser;
