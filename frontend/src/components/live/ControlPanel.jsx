import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Nfc, Send, XOctagon, RotateCcw, Droplet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { normalizeCard } from '../../services/api';
import { WOKWI_CARDS } from '../../services/wokwiCards';

/**
 * Dashboard → ESP32 controls:
 *   • tap a Wokwi card without clicking the RFID reader
 *   • start an order for a student from the dashboard
 *   • emergency stop / reset the station
 */
export const ControlPanel = ({ station }) => {
  const { users, sendStationCommand, waterPricePerLiter } = useApp();
  const [orderUserId, setOrderUserId] = useState('USR001');
  const [orderLiters, setOrderLiters] = useState(1);
  const [busy, setBusy] = useState(false);

  const online = Boolean(station?.online);
  const state = station?.state;
  const canTap = online && state === 'IDLE';
  const canOrder = online && state === 'IDLE'; // never replace a student who is already at the tap

  const ownerOf = (uid) => users.find((u) => normalizeCard(u.rfid) === normalizeCard(uid));

  // Run a command and show a toast with the result
  const run = async (action, params, successText) => {
    setBusy(true);
    try {
      await sendStationCommand(action, params);
      toast.success(successText);
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      {/* 1. Virtual card tap */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Nfc className="w-4 h-4 text-sky-500" /> Tap a card (virtual)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WOKWI_CARDS.map((card) => {
            const owner = ownerOf(card.uid);
            return (
              <button
                key={card.uid}
                disabled={!canTap || busy}
                onClick={() => run('tap_card', { uid: card.uid }, `${card.label} tapped`)}
                title={card.hint}
                className={`text-left p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md hover:scale-[1.03] active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed`}
              >
                <p className="text-[11px] font-extrabold">{card.label}</p>
                <p className="text-[10px] font-semibold text-white/85 truncate">
                  {owner ? owner.name : 'Not registered'}
                </p>
                <p className="text-[9px] font-mono text-white/70 truncate">{card.uid}</p>
              </button>
            );
          })}
        </div>
        {!canTap && <p className="text-[11px] text-slate-400">Available when the station shows “Waiting for a card”.</p>}
      </section>

      {/* 2. Start order from the dashboard */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Droplet className="w-4 h-4 text-cyan-500" /> Start an order from here
        </h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={orderUserId}
            onChange={(e) => setOrderUserId(e.target.value)}
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · ₹{Number(u.balance).toFixed(0)} · {u.status}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {[1, 2, 5].map((l) => (
              <button
                key={l}
                onClick={() => setOrderLiters(l)}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  orderLiters === l ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {l} L
              </button>
            ))}
          </div>
        </div>
        <button
          disabled={!canOrder || busy}
          onClick={() =>
            run('start_order', { user_id: orderUserId, liters: orderLiters }, `Order sent to the station (₹${orderLiters * waterPricePerLiter})`)
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-sky-600 shadow-md shadow-sky-500/20 hover:opacity-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" /> Send {orderLiters} L order to Wokwi station
        </button>
      </section>

      {/* 3. Safety */}
      <section className="grid grid-cols-2 gap-2">
        <button
          disabled={!online || busy}
          onClick={() => run('stop', {}, 'Emergency stop sent – valve closing')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-rose-600 to-red-500 shadow-lg shadow-rose-500/30 hover:opacity-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <XOctagon className="w-4 h-4" /> Emergency stop
        </button>
        <button
          disabled={!online || busy}
          onClick={() => run('reset', {}, 'Station reset')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" /> Reset station
        </button>
      </section>
    </div>
  );
};
