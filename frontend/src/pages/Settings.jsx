import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Shield, Radio, RotateCcw, Droplets, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';

const Card = ({ icon: Icon, color, title, children }) => (
  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex items-center gap-2">
      <Icon className={`w-5 h-5 ${color}`} />
      <h3 className="text-base font-bold text-slate-900 font-['Outfit']">{title}</h3>
    </div>
    {children}
  </div>
);

export const Settings = () => {
  const { settings, saveSettings, mqttStatus, resetDemoData } = useApp();
  const [price, setPrice] = useState(settings.waterPricePerLiter);
  const [quota, setQuota] = useState(settings.dailyQuotaLiters);

  // show the backend's values once they are loaded
  useEffect(() => {
    setPrice(settings.waterPricePerLiter);
    setQuota(settings.dailyQuotaLiters);
  }, [settings.waterPricePerLiter, settings.dailyQuotaLiters]);

  // Saved in the backend, so the Wokwi station and every page use the new values
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await saveSettings({ waterPricePerLiter: Number(price), dailyQuotaLiters: Number(quota) });
      toast.success(`Saved! ₹${price}/L, daily quota ${quota} L per student.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all users, wallets, transactions and alerts to the demo data?')) return;
    try {
      await resetDemoData();
      toast.success('Demo data restored');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const input = 'w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-sky-900 rounded-3xl text-white shadow-xl">
        <h2 className="text-xl font-bold font-['Outfit']">System Settings</h2>
        <p className="text-xs text-slate-300 mt-0.5">Everything here is saved in the backend and used by the Wokwi station too.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card icon={CreditCard} color="text-emerald-600" title="Water price">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹ per litre)</label>
              <input type="number" min="1" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <input type="text" disabled value="INR (₹)" className={`${input} bg-slate-100 text-slate-500 font-bold`} />
            </div>
          </div>
        </Card>

        <Card icon={Droplets} color="text-sky-600" title="Daily water allotment">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quota per student (litres / day)</label>
              <input type="number" min="1" step="1" value={quota} onChange={(e) => setQuota(e.target.value)} className={input} />
            </div>
            <p className="text-xs text-slate-500 self-end">
              Orders above the quota – or above a student's own normal limit (average + 3σ) – are still dispensed, but the admin gets
              one alert per student per day on the Dashboard and Alerts pages.
            </p>
          </div>
        </Card>

        <Button type="submit" size="lg" icon={Save} className="w-full py-3">
          Save settings
        </Button>
      </form>

      <Card icon={Shield} color="text-indigo-600" title="Payments (Razorpay test mode)">
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
          <li>Water is always paid from the student's prepaid wallet (PAY button in Wokwi or “Pay from wallet”).</li>
          <li>Money enters a wallet only through a Razorpay top-up; the backend verifies the signature with the key secret.</li>
          <li>Keys live only in <code className="px-1 rounded bg-slate-100">backend/.env</code> (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) – never in the browser.</li>
          <li>Unused litres and stuck orders are refunded to the wallet automatically.</li>
        </ul>
      </Card>

      <Card icon={Radio} color="text-violet-600" title="Wokwi station link (MQTT)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-400 font-semibold">Broker</p>
            <p className="font-mono font-bold text-slate-800">{mqttStatus ? `${mqttStatus.broker}:${mqttStatus.port}` : '—'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-400 font-semibold">Topic root (must match sketch.ino)</p>
            <p className="font-mono font-bold text-slate-800 break-all">{mqttStatus?.topicRoot || '—'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-400 font-semibold">Status</p>
            <p className={`font-bold ${mqttStatus?.connected ? 'text-emerald-600' : 'text-rose-600'}`}>
              {mqttStatus?.connected ? `Connected (${mqttStatus.transport})` : mqttStatus?.error || 'Not connected'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Change these in backend/.env (MQTT_BROKER, MQTT_PORT, MQTT_TRANSPORT, MQTT_TOPIC_ROOT) and in the SETTINGS block of sketch.ino.</p>
      </Card>

      <Card icon={RotateCcw} color="text-rose-600" title="Demo data">
        <p className="text-xs text-slate-500">Restores the demo students, wallets, 30-day history and clears orders, top-ups and alerts.</p>
        <Button type="button" variant="outline" icon={RotateCcw} onClick={handleResetDemo}>
          Reset demo data
        </Button>
      </Card>
    </div>
  );
};

export default Settings;
