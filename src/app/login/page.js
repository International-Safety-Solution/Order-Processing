'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, AlertCircle, Building2, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ app_name: 'Order Management', app_logo: null });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) {
          setSettings({
            app_name: data.app_name || 'Order Management',
            app_logo: data.app_logo || null
          });
        }
      })
      .catch(err => console.error('Failed to fetch login page branding settings:', err));
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        if (!res.ok) {
          throw new Error(`Server error (${res.status}). Please try again.`);
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Hard redirect to guarantee layout session update
      if (data.user.role === 'ADMIN') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/staff';
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Decorative Pastel Rings */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-white border border-zinc-200 p-8 rounded-2xl shadow-xl relative z-10">
        <div>
          {settings.app_logo ? (
            <div className="mx-auto flex items-center justify-center overflow-hidden p-2" style={{ maxHeight: '100px', maxWidth: '260px' }}>
              <img
                src={settings.app_logo}
                alt="App Logo"
                style={{ maxHeight: '80px', maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                className="max-h-20 max-w-full w-auto h-auto object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center shadow-md">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-950 tracking-tight font-sans">
            {settings.app_name}
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Sign in to access your designated workflow
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin} method="POST" action="#">
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-zinc-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-zinc-300 bg-white text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange sm:text-sm placeholder-zinc-400"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-zinc-300 bg-white text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange sm:text-sm placeholder-zinc-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange disabled:opacity-50 transition-colors shadow-sm cursor-pointer font-sans"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
