import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ShieldAlert, CheckCircle2, Info, Filter, ArrowUpRight, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const Alerts = () => {
  const { alerts, anomalies, resolveAlert } = useApp();
  const [severityFilter, setSeverityFilter] = useState('All'); // All | Critical | Warning | Info

  const filteredAlerts = alerts.filter((a) =>
    severityFilter === 'All' ? true : a.severity === severityFilter
  );

  const handleResolveAlert = async (id) => {
    try {
      await resolveAlert(id);
      toast.success(`Alert ${id} acknowledged & marked as resolved.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4 animate-pulse" /> Statistical 3-Sigma Anomaly Engine
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit']">Anomaly & Leakage Detection</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Automated threshold evaluation ($\mu + 3\sigma$) detecting abnormal flow surges or shared RFID usage.
          </p>
        </div>
      </div>

      {/* 3-Sigma Mathematical Concept Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">3-Sigma Anomaly Detection Framework</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          AquaAllot computes the historical mean ($\mu$) and standard deviation ($\sigma$) of daily water consumption per user. Any transaction pushing daily volume past the upper control limit ($\mu + 3\sigma$) flags an anomaly alert for administrator review.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {anomalies.map((anom) => (
            <div
              key={anom.id}
              className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{anom.userName}</h4>
                  <span className="text-[11px] text-slate-500">Target ID: {anom.userId}</span>
                </div>
                <Badge variant={anom.severity === 'Critical' ? 'danger' : 'info'}>
                  {anom.deviation} Anomaly
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-2 p-3 bg-white rounded-xl border border-rose-100 text-xs text-center font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block">Mean ($\mu$)</span>
                  <span className="font-bold text-slate-800">{anom.mean} L</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Std Dev ($\sigma$)</span>
                  <span className="font-bold text-slate-800">{anom.stdDev} L</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Upper Cap</span>
                  <span className="font-bold text-slate-800">{anom.upperThreshold} L</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Observed</span>
                  <span className="font-black text-rose-600">{anom.observed} L</span>
                </div>
              </div>

              <p className="text-xs text-rose-900 leading-normal font-medium">{anom.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">Active System Warnings</h3>
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
          {['All', 'Critical', 'Warning', 'Info'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                severityFilter === sev ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.map((alt) => (
          <div
            key={alt.id}
            className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-sky-200 transition-colors"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  alt.severity === 'Critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{alt.title}</h4>
                  <Badge variant={alt.severity === 'Critical' ? 'danger' : 'warning'}>
                    {alt.severity}
                  </Badge>
                  <Badge variant={alt.status === 'Resolved' ? 'success' : 'neutral'}>
                    {alt.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">{alt.description}</p>
                <span className="text-[10px] text-slate-400 mt-1.5 block">{alt.timestamp}</span>
              </div>
            </div>

            {alt.status !== 'Resolved' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResolveAlert(alt.id)}
                className="shrink-0"
              >
                Acknowledge Alert
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
