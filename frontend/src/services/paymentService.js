export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
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
};

export const initializeRazorpayPayment = async ({
  orderId,
  amount,
  keyId = import.meta.env.VITE_RAZORPAY_KEY_ID,
  userName = 'Arun Kumar',
  userEmail = 'arun@example.com',
  onSuccess,
  onFailure
}) => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    onFailure({ message: 'Razorpay SDK failed to load.' });
    return;
  }

  const options = {
    key: keyId,
    amount: amount, // in paise
    currency: 'INR',
    name: 'AquaAllot Water Dispenser',
    description: 'Prepaid Water Purchase',
    order_id: orderId,
    prefill: {
      name: userName,
      email: userEmail
    },
    theme: {
      color: '#0284c7'
    },
    handler: function (response) {
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      });
    },
    modal: {
      ondismiss: function () {
        onFailure({ message: 'Payment window closed by user.' });
      }
    }
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
};
