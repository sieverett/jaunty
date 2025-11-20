
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-brand-600 p-8 text-center">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-brand-100 mt-2 text-sm">
            {isRegistering 
              ? 'Join the intelligent forecasting platform' 
              : 'Sign in to access your revenue dashboard'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {isRegistering && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    role === 'admin' 
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm mb-1">Admin</div>
                  <div className="text-xs text-slate-500">Full access & config</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('analyst')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    role === 'analyst' 
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm mb-1">Analyst</div>
                  <div className="text-xs text-slate-500">View & Simulate</div>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering ? 'Create Account' : 'Sign In'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>

          <div className="text-center text-sm text-slate-500">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-1 text-brand-600 font-semibold hover:underline focus:outline-none"
            >
              {isRegistering ? 'Sign In' : 'Register'}
            </button>
          </div>
        </form>
        
        {/* Demo Hint */}
        {!isRegistering && (
          <div className="bg-slate-50 p-4 text-xs text-slate-400 text-center border-t border-slate-100">
            Hint: Use "analyst@company.com" to test restricted access.
          </div>
        )}
      </div>
    </div>
  );
};
