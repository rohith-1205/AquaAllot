import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Wallet, Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { initializeRazorpayPayment } from '../../services/paymentService';

/**
 * Pay for the order that is waiting at the Wokwi station.
 *   1. backend creates a Razorpay order     (POST /api/orders/:id/checkout)
 *   2. Razorpay test popup opens here
 *   3. backend verifies the signature        (POST /api/orders/:id/confirm)
 *   4. backend tells the ESP32 "payment_ok" → valve opens in Wokwi
 */
export const PaymentPanel = ({ station }) => {
  const [busy, setBusy] = useState(false);
  const order = station?.order;
  const waitingForPayment = station?.state === 'AWAITING_PAYMENT' && order?.status === 'pending';

  if (!order) {
    return (
      <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-500">
        No order yet. Tap a card and choose 1 / 2 / 5 L in Wokwi – or start one from the control panel.
      </div>
    );
  }

  const confirmPayment = async (payment) => {
    await api.confirmOrder(order.id, payment);
    toast.success('Payment verified – valve opening in Wokwi! 💧');
  };

  const payWithRazorpay = async () => {
    setBusy(true);
    try {
      const { razorpay, user } = await api.checkoutOrder(order.id);

      if (!razorpay.is_real_key) {
        // No Razorpay keys in backend/.env → simulated payment
        await confirmPayment({ test_mode: true });
        setBusy(false);
        return;
      }

      await initializeRazorpayPayment({
        orderId: razorpay.id,
        amount: razorpay.amount,
        keyId: razorpay.key,
        userName: user?.name,
        userEmail: user?.email,
        onSuccess: async (response) => {
          try {
            await confirmPayment(response);
          } catch (err) {
            toast.error(err.message);
          }
          setBusy(false);
        },
        onFailure: (err) => {
          toast.error(err.message || 'Payment cancelled');
          setBusy(false);
        }
      });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const payInTestMode = async () => {
    setBusy(true);
    try {
      await confirmPayment({ test_mode: true });
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {/* Order summary */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 border border-sky-100">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Order {order.id}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              order.status === 'pending'
                ? 'bg-amber-400 text-white'
                : order.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : order.status === 'stopped'
                    ? 'bg-rose-500 text-white'
                    : 'bg-sky-500 text-white'
            }`}
          >
            {order.status}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold font-['Outfit'] text-slate-900">₹{Number(order.amount).toFixed(0)}</p>
            <p className="text-xs text-slate-600 font-semibold">
              {order.liters} L for {order.userName} · from {order.source === 'dashboard' ? 'dashboard' : 'station'}
            </p>
          </div>
          {order.paymentMethod && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> {order.paymentMethod}
            </span>
          )}
        </div>
      </div>

      {waitingForPayment && (
        <>
          <button
            onClick={payWithRazorpay}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-white bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-500 shadow-lg shadow-sky-500/30 hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            Pay ₹{Number(order.amount).toFixed(0)} with Razorpay
          </button>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> or press <b>PAY</b> in Wokwi to use the wallet
            </span>
            <button onClick={payInTestMode} disabled={busy} className="flex items-center gap-1 font-semibold text-violet-600 hover:underline cursor-pointer">
              <Zap className="w-3.5 h-3.5" /> test payment
            </button>
          </div>
        </>
      )}
    </div>
  );
};
