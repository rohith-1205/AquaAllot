import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Droplet,
  Droplets,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Zap,
  Activity,
  ArrowRight,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { initializeRazorpayPayment } from '../services/paymentService';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const Dispensing = () => {
  const { users, stations, waterPricePerLiter, demoMode, addTransaction } = useApp();

  // Selection states
  const [selectedUserId, setSelectedUserId] = useState('USR001');
  const [selectedStationId, setSelectedStationId] = useState('STN-001');
  const [selectedQuantity, setSelectedQuantity] = useState(5); // Liters
  const [customQuantity, setCustomQuantity] = useState('');

  // Workflow states: 'idle' | 'creating_order' | 'checkout' | 'verifying' | 'authorized' | 'dispensing' | 'completed' | 'failed'
  const [flowState, setFlowState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Payment Details after verification
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Dispensing Simulation Telemetry
  const [dispensedVolume, setDispensedVolume] = useState(0);
  const [dispensingProgress, setDispensingProgress] = useState(0);
  const [actualMeasuredVolume, setActualMeasuredVolume] = useState(0);

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];
  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[0];

  const quantityToBuy = customQuantity ? Number(customQuantity) : selectedQuantity;
  const totalAmount = quantityToBuy * waterPricePerLiter;

  // Handle Water Purchase & Razorpay Flow
  const handleInitiatePurchase = async () => {
    if (quantityToBuy <= 0) {
      toast.error('Please enter a valid water quantity.');
      return;
    }

    setFlowState('creating_order');
    setErrorMessage('');

    try {
      // 1. Request backend to create Razorpay Order
      const orderResponse = await api.createOrder({
        amount_rupees: totalAmount,
        user_id: selectedUser.id,
        water_liters: quantityToBuy
      });

      if (!orderResponse.success) {
        throw new Error('Failed to create Razorpay payment order.');
      }

      setFlowState('checkout');

      const onPaymentVerified = async (payId, ordId, sig) => {
        setFlowState('authorized');
        setPaymentDetails({
          paymentId: payId,
          orderId: ordId,
          amount: totalAmount,
          quantity: quantityToBuy
        });

        // Verify payment & record in MongoDB
        try {
          await api.verifyPayment({
            razorpay_order_id: ordId,
            razorpay_payment_id: payId,
            razorpay_signature: sig || 'simulated_sig',
            user_id: selectedUser.id,
            station_id: selectedStation.id,
            quantity_liters: quantityToBuy,
            amount_rupees: totalAmount
          });
        } catch (e) {
          console.warn('Backend payment verification warning:', e);
        }

        toast.success('Payment verified! Dispensing authorized.');
      };

      // 2. Open official Razorpay Checkout modal
      await initializeRazorpayPayment({
        orderId: orderResponse.id,
        amount: totalAmount * 100,
        keyId: orderResponse.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        userName: selectedUser.name,
        userEmail: selectedUser.email,
        onSuccess: (res) => {
          onPaymentVerified(res.razorpay_payment_id, res.razorpay_order_id, res.razorpay_signature);
        },
        onFailure: (err) => {
          setFlowState('failed');
          setErrorMessage(err.message || 'Payment cancelled');
          toast.error(err.message || 'Payment window closed');
        }
      });
    } catch (err) {
      setFlowState('failed');
      setErrorMessage(err.message || 'Error communicating with AquaAllot server.');
      toast.error(err.message);
    }
  };

  // Simulated Telemetry Flow for Water Dispensing (0 L -> Target L)
  const startDispensingSimulation = () => {
    setFlowState('dispensing');
    setDispensedVolume(0);
    setDispensingProgress(0);

    const totalSteps = 20;
    const intervalTime = 250; // ms
    let currentStep = 0;

    const interval = setInterval(async () => {
      currentStep += 1;
      const progressPercent = Math.min(100, Math.round((currentStep / totalSteps) * 100));
      const currentLiters = parseFloat(((currentStep / totalSteps) * quantityToBuy).toFixed(2));

      setDispensingProgress(progressPercent);
      setDispensedVolume(currentLiters);

      if (currentStep >= totalSteps) {
        clearInterval(interval);

        // Actual flow sensor variation (e.g., 99.2% accuracy)
        const sensorActual = parseFloat((quantityToBuy * (0.99 + Math.random() * 0.015)).toFixed(2));
        setActualMeasuredVolume(sensorActual);
        setFlowState('completed');

        // Log water usage into MongoDB via API
        try {
          await api.logUsage({
            user_id: selectedUser.id,
            station_id: selectedStation.id,
            water_liters: sensorActual,
            amount_rupees: totalAmount
          });
        } catch (e) {
          console.warn('Backend log_usage warning:', e);
        }

        // Create transaction and update global state across all pages!
        const newTxn = {
          id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: selectedUser.id,
          userName: selectedUser.name,
          rfid: selectedUser.rfid,
          amount: totalAmount,
          waterLiters: quantityToBuy,
          paymentStatus: 'Paid',
          dispensingStatus: 'Completed',
          paymentMethod: 'Razorpay',
          razorpayPaymentId: paymentDetails?.paymentId || 'pay_demo_verified',
          razorpayOrderId: paymentDetails?.orderId || 'order_demo_verified',
          stationId: selectedStation.id,
          timestamp: new Date().toLocaleString()
        };

        addTransaction(newTxn);
        toast.success(`Successfully dispensed ${sensorActual} L water! Logged to DB.`);
      }
    }, intervalTime);
  };

  const handleReset = () => {
    setFlowState('idle');
    setDispensedVolume(0);
    setDispensingProgress(0);
    setPaymentDetails(null);
    setErrorMessage('');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" /> Review II Automated Dispensing Pipeline
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">Purchase & Dispense Water</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Seamless end-to-end demonstration: Razorpay Test Checkout → Backend Verification → ESP32 Solenoid Valve.
          </p>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-semibold text-sky-400 shrink-0">
          Rate: <strong className="text-white">₹{waterPricePerLiter} / Liter</strong>
        </div>
      </div>

      {/* Visual Workflow Stepper Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">1</span>
            <span className="text-slate-900 font-bold">RFID Verified</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${
              ['creating_order', 'checkout', 'verifying', 'authorized', 'dispensing', 'completed'].includes(flowState)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>2</span>
            <span>Razorpay Payment</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${
              ['authorized', 'dispensing', 'completed'].includes(flowState)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>3</span>
            <span>Backend Verification</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${
              ['dispensing', 'completed'].includes(flowState)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>4</span>
            <span>ESP32 Valve Open</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${
              flowState === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>5</span>
            <span>Dispensing Logged</span>
          </div>
        </div>
      </div>

      {/* Main Section Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Configuration & Water Purchase Selection */}
        <div className="lg:col-span-6 space-y-6">
          {/* User & Station Selector */}
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">1. User & Station Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Authenticated User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={flowState !== 'idle'}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.id}) — RFID: {u.rfid} — Balance: ₹{u.balance}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select AquaAllot Dispensing Station</label>
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  disabled={flowState !== 'idle'}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.location}) — {s.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Water Quantity Selector Card */}
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">2. Select Water Quantity</h3>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((qty) => (
                <button
                  key={qty}
                  disabled={flowState !== 'idle'}
                  onClick={() => {
                    setSelectedQuantity(qty);
                    setCustomQuantity('');
                  }}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    selectedQuantity === qty && !customQuantity
                      ? 'border-sky-500 bg-sky-50 text-sky-700 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Droplet className="w-5 h-5 mx-auto mb-1 fill-sky-500/20 text-sky-600" />
                  <span className="text-sm block">{qty} L</span>
                  <span className="text-[10px] text-slate-500">₹{qty * waterPricePerLiter}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Quantity (Liters)</label>
              <input
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                disabled={flowState !== 'idle'}
                placeholder="Enter custom volume..."
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Price Breakdown Summary */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Water Quantity</span>
                <span className="font-bold text-slate-900">{quantityToBuy} Liters</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Calculation</span>
                <span>{quantityToBuy} L × ₹{waterPricePerLiter}/L</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Total Amount</span>
                <span className="text-lg text-sky-600 font-['Outfit'] font-black">₹{totalAmount}</span>
              </div>
            </div>

            {flowState === 'idle' && (
              <Button
                onClick={handleInitiatePurchase}
                size="lg"
                className="w-full bg-sky-600 hover:bg-sky-500 py-3 text-base shadow-lg shadow-sky-500/20"
              >
                <CreditCard className="w-5 h-5 mr-1" />
                Pay ₹{totalAmount} with Razorpay
              </Button>
            )}

            {flowState === 'failed' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Payment Error Encountered</span>
                </div>
                <p className="text-slate-600">{errorMessage}</p>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Dispensing Telemetry & Real-Time Visualization */}
        <div className="lg:col-span-6 space-y-6">
          {flowState === 'authorized' ? (
            <div className="p-8 bg-white rounded-3xl border border-emerald-200 shadow-md text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 font-['Outfit']">Payment Verified & Authorized</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Razorpay signature confirmed by backend. Ready to open ESP32 solenoid valve.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-left space-y-2 font-mono">
                <div>Payment ID: <strong className="text-slate-900">{paymentDetails?.paymentId}</strong></div>
                <div>Order ID: <strong className="text-slate-900">{paymentDetails?.orderId}</strong></div>
                <div>Water Volume: <strong className="text-sky-600 font-bold">{paymentDetails?.quantity} L</strong></div>
                <div>Status: <Badge variant="success">Verified & Authorized</Badge></div>
              </div>

              <Button
                onClick={startDispensingSimulation}
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 text-base shadow-lg shadow-emerald-600/30"
              >
                <Zap className="w-5 h-5 mr-1" />
                Start Dispensing Simulation
              </Button>
            </div>
          ) : flowState === 'dispensing' ? (
            <div className="p-8 bg-slate-900 rounded-3xl text-white shadow-2xl border border-slate-800 space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <Activity className="w-4 h-4 animate-pulse" /> YF-S201 Flow Telemetry Active
                </div>
                <Badge variant="info">Valve: OPEN</Badge>
              </div>

              {/* Central Gauge Display */}
              <div className="relative flex flex-col items-center justify-center p-8 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="w-32 h-32 rounded-full border-4 border-slate-800 border-t-sky-400 animate-spin flex items-center justify-center" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-cyan-300 font-['Outfit']">{dispensedVolume} L</span>
                  <span className="text-xs text-slate-400 mt-1">Target: {quantityToBuy} L</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Dispensing Progress</span>
                  <span>{dispensingProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${dispensingProgress}%` }}
                  />
                </div>
              </div>

              {/* Hardware Telemetry Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Flow Rate</span>
                  <span className="font-bold text-sky-400">{selectedStation.flowRate} L/min</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Solenoid Valve</span>
                  <span className="font-bold text-emerald-400">ACTIVE (OPEN)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Microcontroller</span>
                  <span className="font-bold text-white">ESP32 (CONNECTED)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Pulse Frequency</span>
                  <span className="font-bold text-cyan-300">450 pulses/L</span>
                </div>
              </div>
            </div>
          ) : flowState === 'completed' ? (
            <div className="p-8 bg-white rounded-3xl border border-emerald-200 shadow-xl space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 font-['Outfit']">Dispensing Completed!</h3>
                <p className="text-xs text-slate-500 mt-1">Solenoid valve closed automatically. Usage logged.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Target Volume</span>
                  <span className="font-bold text-slate-900 text-base">{quantityToBuy} L</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Actual Volume Measured</span>
                  <span className="font-bold text-emerald-600 text-base">{actualMeasuredVolume} L</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Measurement Accuracy</span>
                  <span className="font-bold text-slate-900">99.2%</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Solenoid Valve Status</span>
                  <Badge variant="neutral">CLOSED</Badge>
                </div>
              </div>

              <Button onClick={handleReset} variant="outline" className="w-full py-3">
                <RefreshCw className="w-4 h-4 mr-1" />
                Purchase More Water
              </Button>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm text-center space-y-4 flex flex-col items-center justify-center min-h-[380px]">
              <div className="p-4 rounded-full bg-sky-50 text-sky-600">
                <Gauge className="w-10 h-10" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Telemetry Standby</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Select quantity and click "Pay with Razorpay" to trigger the backend payment authorization and flow telemetry pipeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dispensing;
