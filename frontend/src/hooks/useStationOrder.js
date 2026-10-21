import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';

/**
 * Start a water order on the REAL Wokwi station from a dashboard page
 * (used by the Dispensing and Kiosk pages) and follow it live.
 *
 *   phase: 'select'     → choose student + litres
 *          'pay'        → order waiting at the station (pay from wallet / top up)
 *          'dispensing' → valve open, litres arriving from the ESP32
 *          'done'       → valve closed (completed, stopped or refunded)
 *          'lost'       → the station dropped the order (reset / cancelled / restarted)
 */
export const useStationOrder = () => {
  const { liveStation, sendStationCommand } = useApp();
  const [orderId, setOrderId] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastSeen = useRef(null); // remembers our order after the station moves on to the next student

  const online = Boolean(liveStation?.online);
  const stationIdle = online && liveStation.state === 'IDLE';
  if (orderId && liveStation?.order?.id === orderId) lastSeen.current = liveStation.order;
  const order = orderId && lastSeen.current?.id === orderId ? lastSeen.current : null;

  let phase = 'select';
  if (orderId) {
    const stillAtStation = liveStation?.order?.id === orderId;
    if (!order || order.status === 'cancelled') phase = 'lost';
    else if (!stillAtStation && ['pending', 'paid'].includes(order.status)) phase = 'lost';
    else if (order.status === 'pending') phase = 'pay';
    else if (order.status === 'paid') phase = 'dispensing';
    else phase = 'done';
  }

  const startOrder = async (userId, liters) => {
    setBusy(true);
    try {
      const res = await sendStationCommand('start_order', { user_id: userId, liters });
      setOrderId(res.order.id);
      toast.success(`Order sent to the Wokwi station (${liters} L)`);
      if (res.order.warning) toast(`⚠ ${res.order.warning} – admin alerted`, { icon: '🚨' });
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const reset = () => {
    lastSeen.current = null;
    setOrderId(null);
  };

  return { station: liveStation, online, stationIdle, order, phase, busy, startOrder, reset };
};
