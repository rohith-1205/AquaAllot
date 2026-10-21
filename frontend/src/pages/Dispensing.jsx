import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplet, Radio, Send, RefreshCw, Gauge, Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useStationOrder } from '../hooks/useStationOrder';
import { WaterTank } from '../components/live/WaterTank';
import { PaymentPanel } from '../components/live/PaymentPanel';
import { StepTracker } from '../components/live/StepTracker';
import { rupees } from '../utils/format';

const QUANTITIES = [1, 2, 5, 10];
const MAX_LITERS = 20;

/**
 * Admin "New water order": picks a student + litres and sends the order to the
 * REAL Wokwi station. Payment always comes from the student's wallet.
 */
export const Dispensing = () => {
  const { users, waterPricePerLiter } = useApp();
  const { station, online, stationIdle, order, phase, busy, startOrder, reset } = useStationOrder();

  const activeUsers = users.filter((u) => u.status !== 'Suspended' && u.status !== 'Inactive');
  const [selectedUserId, setSelectedUserId] = useState('USR001');
  const [selectedQuantity, setSelectedQuantity] = useState(2);
  const [customQuantity, setCustomQuantity] = useState('');

  const selectedUser = activeUsers.find((u) => u.id === selectedUserId) || activeUsers[0];
  const liters = customQuantity ? Number(customQuantity) : selectedQuantity;
  const total = liters * waterPricePerLiter;
  const validLiters = liters > 0 && liters <= MAX_LITERS;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-sky-900 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" /> Sends a real order to the Wokwi ESP32
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">New Water Order</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">Pick a student and litres → pay from their wallet → watch the valve open in Wokwi.</p>
        </div>
        <div
          className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 ${
            online ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : 'bg-rose-400/20 text-rose-300 border border-rose-400/40'
          }`}
        >
          <Cpu className="w-4 h-4 inline mr-1" />
          {online ? `Station online · ${station.state.replace('_', ' ').toLowerCase()}` : 'Station offline'}
        </div>
      </div>

      {!online && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Start the Wokwi simulation first – orders go to the real station. See <Link to="/live" className="font-bold underline">Live Station</Link>.
        </div>
      )}

      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <StepTracker state={phase === 'select' ? 'CARD_OK' : station?.state} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: student + litres */}
        <div className="lg:col-span-5 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Student</label>
            <select
              value={selectedUser?.id}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={phase !== 'select'}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · wallet {rupees(u.balance)} · today {u.todayUsage} L
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Litres</label>
            <div className="grid grid-cols-4 gap-2">
              {QUANTITIES.map((qty) => (
                <button
                  key={qty}
                  disabled={phase !== 'select'}
                  onClick={() => {
                    setSelectedQuantity(qty);
                    setCustomQuantity('');
                  }}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    selectedQuantity === qty && !customQuantity
                      ? 'border-sky-500 bg-gradient-to-b from-sky-50 to-cyan-50 text-sky-700 font-bold shadow-md shadow-sky-500/10'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Droplet className="w-5 h-5 mx-auto mb-1 fill-sky-500/20 text-sky-600" />
                  <span className="text-sm block">{qty} L</span>
                  <span className="text-[10px] text-slate-500">{rupees(qty * waterPricePerLiter)}</span>
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0.5"
              max={MAX_LITERS}
              step="0.5"
              disabled={phase !== 'select'}
              placeholder={`Custom litres (max ${MAX_LITERS})`}
              value={customQuantity}
              onChange={(e) => setCustomQuantity(e.target.value)}
              className="mt-2 w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{liters || 0} L × {rupees(waterPricePerLiter)}</span>
              <span className="text-lg text-sky-600 font-['Outfit'] font-black">{rupees(total)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Wallet of {selectedUser?.name}</span>
              <span className={`font-bold ${selectedUser?.balance >= total ? 'text-emerald-600' : 'text-rose-600'}`}>{rupees(selectedUser?.balance)}</span>
            </div>
          </div>

          {phase === 'select' ? (
            <button
              onClick={() => startOrder(selectedUser.id, liters)}
              disabled={!stationIdle || busy || !validLiters || !selectedUser}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-white bg-gradient-to-r from-sky-600 to-cyan-500 shadow-lg shadow-sky-500/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" /> Send order to Wokwi station
            </button>
          ) : (
            <button
              onClick={reset}
              disabled={phase === 'pay' || phase === 'dispensing'}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> New order
            </button>
          )}
          {phase === 'select' && online && !stationIdle && (
            <p className="text-[11px] text-amber-600">The station is busy with another student – wait until it shows “Waiting for a card”.</p>
          )}
        </div>

        {/* Right: live station */}
        <div className="lg:col-span-7 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-5">
          {phase === 'select' ? (
            <div className="text-center space-y-3 flex flex-col items-center justify-center min-h-[320px]">
              <div className="p-4 rounded-full bg-sky-50 text-sky-600">
                <Gauge className="w-10 h-10" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Waiting for an order</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                The order appears on the Wokwi OLED. Pay here or with the PAY button – the real flow sensor fills the tank below.
              </p>
            </div>
          ) : phase === 'lost' ? (
            <div className="text-center space-y-3 min-h-[320px] flex flex-col items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <h4 className="text-base font-bold text-slate-800">The station dropped this order</h4>
              <p className="text-xs text-slate-500">It was reset, cancelled or restarted. No money was taken for an unpaid order.</p>
            </div>
          ) : (
            <>
              <WaterTank
                dispensed={Number(phase === 'done' ? order.dispensedLiters : station?.dispensed || 0)}
                target={Number(order.liters)}
                flowLpm={Number(station?.flowLpm || 0)}
                valve={station?.valve}
                state={station?.state}
              />
              <PaymentPanel station={{ ...station, order }} />
              {phase === 'done' && (
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" /> Valve closed – saved as {order.txnId}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dispensing;
