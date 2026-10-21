import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { initializeRazorpayPayment } from '../services/paymentService';

/**
 * Add money to a student's wallet with Razorpay (the ONLY way money enters a wallet).
 *
 *   const { topUp, busy } = useWalletTopup();
 *   const ok = await topUp(user, 100);     // true when the money arrived
 *
 *   1. backend creates a Razorpay order          POST /api/users/:id/topup/checkout
 *   2. Razorpay test popup opens here
 *   3. backend checks the signature → wallet +₹   POST /api/topups/:id/confirm
 */
export const useWalletTopup = () => {
  const [busy, setBusy] = useState(false);

  const topUp = async (user, amount) => {
    setBusy(true);
    try {
      const { topup, razorpay, user: payer } = await api.topupCheckout(user.id, amount);

      // No Razorpay keys in backend/.env → the backend accepts a simulated payment
      if (!razorpay.is_real_key) {
        await api.topupConfirm(topup.id, {});
        toast.success(`₹${amount} added to ${user.name}'s wallet (simulated – no Razorpay keys)`);
        return true;
      }

      const response = await new Promise((resolve, reject) => {
        initializeRazorpayPayment({
          orderId: razorpay.id,
          amount: razorpay.amount,
          keyId: razorpay.key,
          userName: payer?.name || user.name,
          userEmail: payer?.email || user.email,
          description: `Wallet top-up ₹${amount}`,
          onSuccess: resolve,
          onFailure: reject
        });
      });

      await api.topupConfirm(topup.id, response);
      toast.success(`₹${amount} added to ${user.name}'s wallet 💰`);
      return true;
    } catch (err) {
      toast.error(err.message || 'Top-up cancelled');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { topUp, busy };
};
