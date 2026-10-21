import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Radio, Cpu, Wifi, Gauge, Settings2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

export const Stations = () => {
  const { stations } = useApp();
  const navigate = useNavigate();
  const [selectedStation, setSelectedStation] = useState(null);

  // The live Wokwi station is controlled from the Live Station page; the others are sample data
  const handleTestValve = (stn) => {
    if (stn.isLive) {
      navigate('/live');
      return;
    }
    toast(`${stn.name} is sample data – there is no device to test.`, { icon: 'ℹ️' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">IoT Station Hardware Telemetry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor ESP32 microcontrollers, RFID RC522 readers, YF-S201 flow sensors, and solenoid valves.
          </p>
        </div>
      </div>

      {/* Stations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stations.map((stn) => (
          <div
            key={stn.id}
            className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-5 hover:border-sky-200 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  {stn.name}
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${stn.isLive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {stn.isLive ? 'LIVE · WOKWI' : 'SAMPLE'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">{stn.location}</p>
              </div>
              <Badge variant={stn.status === 'Online' ? 'success' : stn.status === 'Offline' ? 'danger' : stn.status === 'Sample' ? 'neutral' : 'warning'}>
                {stn.status}
              </Badge>
            </div>

            {/* Hardware Status Grid */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-600" /> ESP32 Controller
                </span>
                <span className="font-bold text-emerald-600">{stn.esp32}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-sky-600" /> RFID Reader (RC522)
                </span>
                <span className="font-bold text-slate-800">{stn.rfidReader}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-sky-600" /> YF-S201 Flow Sensor
                </span>
                <span className="font-bold text-slate-800">{stn.flowSensor}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-sky-600" /> Solenoid Valve
                </span>
                <span className="font-bold text-slate-800">{stn.solenoidValve}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-sky-600" /> WiFi RSSI Signal
                </span>
                <span className="font-mono text-slate-700">{stn.wifiSignal != null ? `${stn.wifiSignal} dBm` : '—'}</span>
              </div>
            </div>

            {/* Heartbeat & Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Last Sync: <strong>{stn.lastSync != null ? `${stn.lastSync}s ago` : '—'}</strong></span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleTestValve(stn)}>
                  {stn.isLive ? 'Open Live' : 'Test Valve'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedStation(stn)}>
                  Details
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Station Modal */}
      <Modal isOpen={!!selectedStation} onClose={() => setSelectedStation(null)} title={`Station Diagnostics: ${selectedStation?.name}`}>
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">Firmware: <strong className="text-slate-900">{selectedStation?.firmware}</strong></p>
          <p className="text-slate-600">Ambient Temperature: <strong className="text-slate-900">{selectedStation?.temperature}</strong></p>
          <p className="text-slate-600">Total Volume Dispensed Today: <strong className="text-sky-600 font-bold">{selectedStation?.todayUsage} L</strong></p>
          <p className="text-slate-600">ESP32: <strong className="text-slate-900">{selectedStation?.esp32}</strong> · Valve: <strong className="text-slate-900">{selectedStation?.solenoidValve}</strong></p>
          <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl space-y-1">
            {selectedStation?.isLive ? (
              <>
                <div>[ESP32] Wokwi simulation · state: {selectedStation?.liveState || 'OFFLINE'}</div>
                <div>[MQTT] {selectedStation?.esp32 === 'Connected' ? 'Connected to broker' : 'Waiting for the simulation'}</div>
                <div>[FLOW] {selectedStation?.flowRate} L/min</div>
              </>
            ) : (
              <div>[SAMPLE] This station is demo data – no real device attached.</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Stations;
