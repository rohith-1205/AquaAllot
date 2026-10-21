import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Sparkles, CreditCard, Shield, Server } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';

export const Settings = () => {
  const { demoMode, toggleDemoMode, waterPricePerLiter, setWaterPricePerLiter } = useApp();
  const [rate, setRate] = useState(waterPricePerLiter);
  const [apiBaseUrl, setApiBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');
  const [razorpayKey, setRazorpayKey] = useState(import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_aquaallot_demo2026');

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setWaterPricePerLiter(Number(rate));
    toast.success('System settings saved successfully!');
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl">
      {/* Header */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">System & Payment Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure AquaAllot rates, Razorpay sandbox credentials, and Review II demo mode.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Review II Demo Mode Toggle */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Review II Demo Mode</h3>
              </div>
              <p className="text-xs text-slate-500">
                When enabled, uses simulated Razorpay checkout callbacks and ESP32 flow sensor telemetry for presentation.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDemoMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                demoMode ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  demoMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 2: Water Pricing Rate */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Water Allocation Pricing</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Water Rate (₹ per Liter)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                disabled
                value="INR (₹)"
                className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Razorpay Sandbox Credentials */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Razorpay Test Gateway Settings</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Razorpay Key ID (Public)</label>
              <input
                type="text"
                value={razorpayKey}
                onChange={(e) => setRazorpayKey(e.target.value)}
                className="w-full px-3.5 py-2 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Configured via VITE_RAZORPAY_KEY_ID in environment variables.</p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px]">
              🔒 Security Enforcement: RAZORPAY_KEY_SECRET is safely stored ONLY on the Flask backend. Signature verification is performed exclusively on backend endpoint <code>/verify_payment</code>.
            </div>
          </div>
        </div>

        {/* Section 4: Backend API URL */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-600" />
            <h3 className="text-base font-bold text-slate-900 font-['Outfit']">Backend Flask Server Integration</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">API Base URL</label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="w-full px-3.5 py-2 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full py-3">
          Save Configuration Changes
        </Button>
      </form>
    </div>
  );
};

export default Settings;
