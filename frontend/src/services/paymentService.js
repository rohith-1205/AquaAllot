// Opens the Razorpay checkout popup. The order is always created by the backend,
// and the backend verifies the signature afterwards – the browser never decides
// on its own that a payment succeeded.

export const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export const initializeRazorpayPayment = async ({
  orderId,
  amount,
  keyId,
  userName,
  userEmail,
  description = 'AquaAllot water order',
  onSuccess,
  onFailure
}) => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    onFailure({ message: 'Razorpay could not load. Check your internet connection.' });
    return;
  }

  const rzp = new window.Razorpay({
    key: keyId,
    amount, // in paise
    currency: 'INR',
    name: 'AquaAllot',
    description,
    order_id: orderId,
    prefill: { name: userName, email: userEmail },
    theme: { color: '#0284c7' },
    handler: (response) =>
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      }),
    modal: { ondismiss: () => onFailure({ message: 'Payment window closed – nothing was charged.' }) }
  });
  rzp.on('payment.failed', (response) => onFailure({ message: response.error?.description || 'Payment failed' }));
  rzp.open();
};
