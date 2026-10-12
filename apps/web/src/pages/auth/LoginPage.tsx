import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, Mail, Building2, AlertCircle, Sparkles } from 'lucide-react';

const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: 'alice.admin@acme.io',
      password: 'Password123!',
      tenantSlug: 'acme-media',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      await login(data.email, data.password, data.tenantSlug);
      navigate('/');
    } catch (err: any) {
      setServerError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoUser = (email: string, slug: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
    setValue('tenantSlug', slug);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Sign in to Asset<span className="text-blue-400">Vault</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Multi-Tenant Digital Asset & License Management System
          </p>
        </div>

        {/* Demo Personas Quick Picker */}
        <div className="mb-6 p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Demo Persona (Seeded):</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setDemoUser('alice.admin@acme.io', 'acme-media')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 transition"
            >
              <span className="font-semibold text-blue-400 block truncate">Acme Admin</span>
              <span className="text-[10px] text-slate-400 block truncate">alice.admin@acme.io</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoUser('charlie.designer@acme.io', 'acme-media')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 transition"
            >
              <span className="font-semibold text-emerald-400 block truncate">Acme Member</span>
              <span className="text-[10px] text-slate-400 block truncate">charlie.designer@acme.io</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoUser('david.admin@nexus.io', 'nexus-tech')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 transition"
            >
              <span className="font-semibold text-purple-400 block truncate">Nexus Admin</span>
              <span className="text-[10px] text-slate-400 block truncate">david.admin@nexus.io</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoUser('superadmin@assetvault.internal', 'system')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 transition"
            >
              <span className="font-semibold text-amber-400 block truncate">Super Admin</span>
              <span className="text-[10px] text-slate-400 block truncate">superadmin@assetvault</span>
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {serverError && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-start space-x-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Organization Slug (Optional)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  {...register('tenantSlug')}
                  placeholder="e.g. acme-media"
                  className="w-full pl-9 pr-3 py-2 bg-slate-850 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@organization.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Google OAuth alternative */}
          <div className="mt-5 pt-5 border-t border-slate-800 text-center">
            <a
              href="/api/v1/auth/google"
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-750 hover:bg-slate-700/60 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition inline-flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Don't have an organization account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Register Tenant
          </Link>
        </p>
      </div>
    </div>
  );
};
