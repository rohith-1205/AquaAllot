import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Wallet, Loader2, CreditCard, CheckCircle2, AlertTriangle, Undo2 } from 'lucide-react';
import { api } from '../../services/api';
import { useWalletTopup } from '../../hooks/useWalletTopup';
import { rupees } from '../../utils/format';

const MIN_TOPUP = 10;

const STATUS_STYLE = {
  pending: 'bg-amber-400 text-white',
  paid: 'bg-sky-500 text-white',
  completed: 'bg-emerald-500 text-white',
  stopped: 'bg-rose-500 text-white',
  failed: 'bg-rose-500 text-white',
  cancelled: 'bg-slate-400 text-white'
};

/**
 * Pay for the order waiting at the Wokwi station – always from the student's wallet.
 *   • wallet has enough → "Pay from wallet"          (same as pressing PAY in Wokwi)
 *   • wallet too low    → "Top up with Razorpay & pay" (adds the missing money, then pays)
 * After the valve closes it shows what was charged and what went back to the wallet.
 */
export const PaymentPanel = ({ station, dark = false }) => {
  const [paying, setPaying] = useState(false);
  const { topUp, busy: toppingUp } = useWalletTopup();
  const order = station?.order;
  const user = station?.user;
  const busy = paying || toppingUp;

  if (!order) {
    return (
      <div className={`p-5 rounded-2xl border-2 border-dashed text-center text-xs ${dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
        No order yet. Tap a card and choose 1 / 2 / 5 L in Wokwi – or start one from here.
      </div>
    );
  }

  const balance = Number(user?.balance || 0);
  const amount = Number(order.amount || 0);
  const walletEnough = balance >= amount;
  const missing = Math.max(MIN_TOPUP, Math.ceil(amount - balance));
  const waitingForPayment = station?.state === 'AWAITING_PAYMENT' && order.status === 'pending';

  const payFromWallet = async () => {
    setPaying(true);
    try {
      await api.payOrderFromWallet(order.id);
      toast.success('Paid from wallet – valve opening in Wokwi! 💧');
    } catch (err) {
      toast.error(err.message);
    }
    setPaying(false);
  };

  const topUpAndPay = async () => {
    if (await topUp(user, missing)) await payFromWallet();
  };

  return (
    <div className="space-y-3">
      {/* Order summary */}
      <div className={`p-4 rounded-2xl border ${dark ? 'bg-slate-950 border-slate-800' : 'bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 border-sky-100'}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Order {order.id}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[order.status] || STATUS_STYLE.paid}`}>
            {order.status}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className={`text-3xl font-extrabold font-['Outfit'] ${dark ? 'text-white' : 'text-slate-900'}`}>{rupees(amount)}</p>
            <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              {order.liters} L for {order.userName} · wallet {rupees(balance)}
            </p>
          </div>
          {['completed', 'stopped', 'failed'].includes(order.status) && (
            <div className="text-right text-xs font-bold">
              <p className="text-emerald-500 flex items-center gap-1 justify-end">
                <CheckCircle2 className="w-4 h-4" /> charged {rupees(order.charged)}
              </p>
              {order.refund > 0 && (
                <p className="text-violet-500 flex items-center gap-1 justify-end">
                  <Undo2 className="w-3.5 h-3.5" /> {rupees(order.refund)} back to wallet
                </p>
              )}
            </div>
          )}
        </div>
        {order.warning && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" /> {order.warning} – admin alerted on the dashboard
          </p>
        )}
      </div>

      {waitingForPayment && (
        <>
          {walletEnough ? (
            <button
              onClick={payFromWallet}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
              Pay {rupees(amount)} from wallet
            </button>
          ) : (
            <button
              onClick={topUpAndPay}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-white bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-500 shadow-lg shadow-sky-500/30 hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Top up {rupees(missing)} with Razorpay & pay
            </button>
          )}
          <p className={`text-[11px] flex items-center gap-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Wallet className="w-3.5 h-3.5" />
            {walletEnough ? 'or press PAY in Wokwi – same wallet, same rules' : `Wallet has ${rupees(balance)}, order needs ${rupees(amount)}`}
          </p>
        </>
      )}
    </div>
  );
};
