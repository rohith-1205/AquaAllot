import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Droplets, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@aquaallot.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const res = login(email, password);
      setIsLoading(false);

      if (res.success) {
        toast.success('Welcome back, System Admin!');
        navigate('/dashboard');
      } else {
        toast.error(res.message);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-['Plus_Jakarta_Sans']">
      {/* Background Glow Accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-xl shadow-sky-500/30 mb-2">
            <Droplets className="w-8 h-8 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-['Outfit']">
            Aqua<span className="text-cyan-400">Allot</span>
          </h1>
          <p className="text-xs font-medium text-slate-400 max-w-xs mx-auto">
            RFID-Based Water Allocation & Smart Dispensing System (Review II)
          </p>
        </div>

        {/* Login Card */}
        <div className="p-8 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-['Outfit']">Administrator Sign In</h2>
            <p className="text-xs text-slate-400">Access system telemetry, users, and payment gateway.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-white placeholder-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-white placeholder-slate-600"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full bg-sky-600 hover:bg-sky-500 py-3 text-sm font-bold shadow-lg shadow-sky-600/30 mt-2"
            >
              {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Credentials Help */}
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
            <div className="text-sky-400 font-bold font-sans">🔑 Demo Quick Login Credentials:</div>
            <div>Email: <span className="text-slate-200">admin@aquaallot.com</span></div>
            <div>Password: <span className="text-slate-200">admin123</span></div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-center text-slate-600 font-medium">
          AquaAllot IoT Platform &copy; 2026. Secured with HMAC-SHA256.
        </p>
      </div>
    </div>
  );
};

export default Login;
