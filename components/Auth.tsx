import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { User, Role } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('analyst');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call latency
    setTimeout(() => {
      // Mock successful auth
      const user: User = {
        email,
        name: name || email.split('@')[0],
        role: isRegistering ? role : 'admin', // Default to admin for login demo unless registering
      };

      // For demo purposes, if logging in with "analyst@example.com", force analyst role
      if (!isRegistering && email.includes('analyst')) {
        user.role = 'analyst';
      }

      onLogin(user);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60">
          <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
            <div className="relative z-10">
              <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {isRegistering ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-blue-100 mt-2 text-sm font-medium">
                {isRegistering
                  ? 'Join the intelligent forecasting platform'
                  : 'Sign in to access your revenue dashboard'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {isRegistering && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                <div className="relative group">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-brand-600" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-slate-50 focus:bg-white shadow-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-brand-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-slate-50 focus:bg-white shadow-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-brand-600" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-slate-50 focus:bg-white shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      role === 'admin'
                        ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-md shadow-brand-100'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">Admin</div>
                    <div className="text-xs text-slate-500">Full access & config</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('analyst')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      role === 'analyst'
                        ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-md shadow-brand-100'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">Analyst</div>
                    <div className="text-xs text-slate-500">View & Simulate</div>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg shadow-brand-600/30 hover:shadow-xl hover:shadow-brand-600/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegistering ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <span className="text-sm text-slate-500">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="ml-1.5 text-sm text-brand-600 font-semibold hover:text-brand-700 hover:underline focus:outline-none transition-colors"
              >
                {isRegistering ? 'Sign In' : 'Register'}
              </button>
            </div>
          </form>

          {!isRegistering && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 px-4 py-3 text-xs text-slate-500 text-center border-t border-slate-200/60">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full"></span>
                Hint: Use "analyst@company.com" to test restricted access
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// Clean Auth component