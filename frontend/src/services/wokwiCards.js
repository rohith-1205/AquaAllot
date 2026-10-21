// The cards built into the Wokwi MFRC522 RFID reader (click the reader in Wokwi to pick one).
// Who owns each card is decided by the backend (backend/demo_data.py).
export const WOKWI_CARDS = [
  { uid: '01:02:03:04', label: 'Blue card', key: 'b', gradient: 'from-blue-500 to-indigo-600', hint: 'Normal purchase – pay with Razorpay' },
  { uid: '11:22:33:44', label: 'Green card', key: 'g', gradient: 'from-emerald-500 to-teal-600', hint: 'Press PAY in Wokwi → Razorpay opens here' },
  { uid: '55:66:77:88', label: 'Yellow card', key: 'y', gradient: 'from-amber-400 to-orange-500', hint: '5 L → over-usage alert for the admin' },
  { uid: 'C0:FF:EE:99', label: 'Key fob', key: 'k', gradient: 'from-orange-500 to-red-500', hint: 'Suspended account' },
  { uid: 'AA:BB:CC:DD', label: 'Red card', key: 'r', gradient: 'from-rose-500 to-pink-600', hint: 'Not registered → denied' },
  { uid: '04:11:22:33:44:55:66', label: 'NFC tag', key: 'n', gradient: 'from-slate-500 to-slate-700', hint: 'Register it on the Users page' }
];

// Steps of one water order, in the order the station goes through them
export const STATION_STEPS = [
  { state: 'IDLE', label: 'Tap card' },
  { state: 'CARD_OK', label: 'Choose litres' },
  { state: 'AWAITING_PAYMENT', label: 'Pay' },
  { state: 'DISPENSING', label: 'Dispensing' },
  { state: 'COMPLETE', label: 'Done' }
];

// Text + colours for every state the ESP32 can report
export const STATE_STYLE = {
  OFFLINE: { label: 'Offline', chip: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  IDLE: { label: 'Waiting for a card', chip: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  CHECKING: { label: 'Checking card…', chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  CARD_OK: { label: 'Choosing litres', chip: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  AWAITING_PAYMENT: { label: 'Waiting for payment', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  DISPENSING: { label: 'Dispensing water', chip: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500' },
  COMPLETE: { label: 'Completed', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  ALERT: { label: 'ALERT – valve closed', chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' }
};
