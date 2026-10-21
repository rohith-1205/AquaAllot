import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { useWalletTopup } from '../../hooks/useWalletTopup';
import { rupees } from '../../utils/format';

const AMOUNTS = [50, 100, 200, 500];

// "Add money to wallet" popup used on the Users and User Details pages (pays with Razorpay)
export const TopUpModal = ({ user, onClose, onDone }) => {
  const [amount, setAmount] = useState(100);
  const { topUp, busy } = useWalletTopup();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await topUp(user, Number(amount))) {
      onDone?.();
      onClose();
    }
  };

  return (
    <Modal isOpen={Boolean(user)} onClose={onClose} title={`Top up ${user?.name || ''}'s wallet`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-600">Current wallet</span>
          <span className="text-xl font-extrabold text-emerald-600 font-['Outfit']">{rupees(user?.balance)}</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                Number(amount) === value ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ₹{value}
            </button>
          ))}
        </div>

        <input
          type="number"
          min="10"
          max="5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          type="submit"
          disabled={busy || Number(amount) < 10}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-sky-500 shadow-lg shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Pay {rupees(amount)} with Razorpay
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          Money is added only after the backend verifies the Razorpay payment signature.
        </p>
      </form>
    </Modal>
  );
};
