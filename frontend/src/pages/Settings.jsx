import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { CreditCard, Shield, Radio, RotateCcw, Droplets, Save, Ban, Bell, Users } from 'lucide-react';
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
  const [limit, setLimit] = useState(settings.dailyLimitLiters);
  const [action, setAction] = useState(settings.limitAction);

  // show the backend's values once they are loaded
  useEffect(() => {
    setPrice(settings.waterPricePerLiter);
    setLimit(settings.dailyLimitLiters);
    setAction(settings.limitAction);
  }, [settings.waterPricePerLiter, settings.dailyLimitLiters, settings.limitAction]);

  // Saved in the backend, so the Wokwi station and every page use the new values
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await saveSettings({ waterPricePerLiter: Number(price), dailyLimitLiters: Number(limit), limitAction: action });
      toast.success(`Saved! ₹${price}/L, default limit ${limit} L per student per day.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all users, transactions and alerts to the demo data?')) return;
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

        <Card icon={Droplets} color="text-sky-600" title="Daily water limit">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default limit (litres per student per day)</label>
              <input type="number" min="0.5" step="0.5" value={limit} onChange={(e) => setLimit(e.target.value)} className={input} />
              <p className="text-[11px] text-slate-500 mt-1.5">
                <Users className="w-3.5 h-3.5 text-violet-500 inline mr-1 -mt-0.5" />
                Used by every student without a personal limit. Set personal limits on the{' '}
                <Link to="/users" className="font-bold text-violet-600 hover:underline">Users page</Link>.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">When an order goes over the limit</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'block', icon: Ban, title: 'Refuse the order', note: 'OLED shows litres left', on: 'border-rose-400 bg-rose-50 text-rose-700' },
                  { key: 'alert', icon: Bell, title: 'Allow + alert', note: 'water flows, admin alerted', on: 'border-amber-400 bg-amber-50 text-amber-700' }
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAction(opt.key)}
                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-colors ${action === opt.key ? opt.on : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    <opt.icon className="w-4 h-4 mb-1" />
                    <span className="block text-xs font-bold">{opt.title}</span>
                    <span className="block text-[10px]">{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">Either way the admin gets one “Daily Limit Exceeded” alert per student per day. Usage resets at midnight.</p>
        </Card>

        <Button type="submit" size="lg" icon={Save} className="w-full py-3">
          Save settings
        </Button>
      </form>

      <Card icon={Shield} color="text-indigo-600" title="Payments (Razorpay test mode)">
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
          <li>Every order is paid with Razorpay: “Pay with Razorpay” on the dashboard, or PAY in Wokwi (opens the checkout on Live Station).</li>
          <li>The backend verifies every payment signature with the key secret before the valve opens.</li>
          <li>Keys live only in <code className="px-1 rounded bg-slate-100">backend/.env</code> (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) – never in the browser.</li>
          <li>Unused litres and stuck orders are refunded automatically through Razorpay's refund API.</li>
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
        <p className="text-xs text-slate-500">Restores the demo students and 30-day history and clears orders and alerts.</p>
        <Button type="button" variant="outline" icon={RotateCcw} onClick={handleResetDemo}>
          Reset demo data
        </Button>
      </Card>
    </div>
  );
};

export default Settings;
