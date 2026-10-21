import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { initializeRazorpayPayment } from '../services/paymentService';

/**
 * Pay one water order with Razorpay (the only way to pay – there is no wallet).
 *
 *   const { payOrder, busy } = useRazorpayCheckout();
 *   await payOrder(order);
 *
 *   1. backend creates a Razorpay order              POST /api/orders/:id/checkout
 *   2. Razorpay test checkout opens here
 *   3. backend verifies the signature → valve opens  POST /api/orders/:id/confirm
 */
export const useRazorpayCheckout = () => {
  const [busy, setBusy] = useState(false);

  const payOrder = async (order) => {
    setBusy(true);
    try {
      const { razorpay, user } = await api.checkoutOrder(order.id);

      // No Razorpay keys in backend/.env → the backend accepts a simulated payment
      if (!razorpay.is_real_key) {
        await api.confirmOrder(order.id, {});
        toast.success('Payment simulated (no Razorpay keys) – valve opening in Wokwi! 💧');
        return true;
      }

      const response = await new Promise((resolve, reject) => {
        initializeRazorpayPayment({
          orderId: razorpay.id,
          amount: razorpay.amount,
          keyId: razorpay.key,
          userName: user?.name,
          userEmail: user?.email,
          description: `${order.liters} L water · ${order.id}`,
          onSuccess: resolve,
          onFailure: reject
        });
      });

      await api.confirmOrder(order.id, response);
      toast.success('Payment verified – valve opening in Wokwi! 💧');
      return true;
    } catch (err) {
      toast.error(err.message || 'Payment cancelled');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { payOrder, busy };
};
