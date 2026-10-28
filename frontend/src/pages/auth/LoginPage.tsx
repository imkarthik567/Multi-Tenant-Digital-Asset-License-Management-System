// ==============================================================================
// AssetVault: Clean Split-Card Enterprise Login Page
// ==============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthAmbientBackground } from './AuthAmbientBackground';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

// Zod validation matching backend auth.validator.ts loginSchema
export const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Feature flag helper to check if Google OAuth is configured
export const isGoogleAuthEnabled = (): boolean => {
  const env = (import.meta as any).env || {};
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const proc = globalObj.process?.env || {};
  return Boolean(
    env.VITE_GOOGLE_CLIENT_ID ||
    env.GOOGLE_CLIENT_ID ||
    proc.VITE_GOOGLE_CLIENT_ID ||
    proc.GOOGLE_CLIENT_ID ||
    win.__ENV__?.GOOGLE_CLIENT_ID ||
    win.__ENV__?.VITE_GOOGLE_CLIENT_ID
  );
};

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';
  const showGoogleOAuth = isGoogleAuthEnabled();

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      let savedRoute = '/';
      try {
        savedRoute =
          sessionStorage.getItem('assetvault_last_route') ||
          localStorage.getItem('assetvault_last_route') ||
          '/';
      } catch {}
      const target = from && from !== '/login' && from !== '/' ? from : savedRoute;
      navigate(target, { replace: true });
    }
  }, [authLoading, isAuthenticated, from, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      const user = await login(data.email, data.password);
      toast.success(`Welcome back, ${user.fullName}!`, 'Signed In Successfully');
      navigate(from, { replace: true });
    } catch (err: any) {
      const errorMsg = err.message || 'Invalid email or password.';
      setServerError(errorMsg);
      toast.error(errorMsg, 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info(
      'Password reset request sent. Please contact your organization administrator or check your recovery inbox.',
      'Password Reset'
    );
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#030712] text-slate-100 overflow-hidden">
      {/* Full-Viewport Ambient Background */}
      <AuthAmbientBackground />

      {/* Main Split-Card Container */}
      <div className="relative z-10 w-full max-w-[1020px] min-h-[600px] rounded-[28px] bg-[#0b1120]/95 backdrop-blur-2xl border border-slate-800/80 shadow-[0_32px_120px_-24px_rgba(2,6,23,0.95)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 animate-fade-in items-stretch">
        {/* LEFT COLUMN: Clean Authentication Form (6 columns on desktop) */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-between relative z-10">
          <div>
            {/* Top Brand Identity */}
            <div className="mb-9">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#3730a3] text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/30 transition-transform shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold text-white tracking-tight">
                  Asset<span className="text-indigo-400">Vault</span>
                </span>
              </Link>
            </div>

            {/* Form Header */}
            <div className="mb-7">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Sign In to AssetVault
              </h1>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                Enter your corporate credentials to continue to your workspace.
              </p>
            </div>

            {/* Server Error Alert */}
            {serverError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Input
                  label="Work Email"
                  type="email"
                  placeholder="name@company.com"
                  iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 select-none">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-indigo-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  iconLeft={<Lock className="w-4 h-4 text-slate-400" />}
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2 font-semibold shadow-lg shadow-indigo-600/25"
                isLoading={isLoading}
                loadingText="Authenticating..."
                iconRight={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to AssetVault
              </Button>
            </form>

            {/* Feature Flagged: Google OAuth SSO */}
            {showGoogleOAuth && (
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2.5 bg-[#0b1120] text-slate-400 uppercase font-medium text-[10px] tracking-wider">
                      Or Continue With SSO
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#131c31]/90 hover:bg-[#1e293b] active:bg-[#1e293b] border border-slate-800 hover:border-indigo-500/40 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
          </div>

          {/* Clean Footer Link to Register Organization */}
          <div className="pt-6 mt-6 border-t border-slate-800/80 text-xs text-slate-400">
            <span>Need a new organization? </span>
            <Link
              to="/register"
              className="font-semibold text-indigo-400 hover:text-cyan-300 hover:underline whitespace-nowrap transition-colors"
            >
              Register Organization &rarr;
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Branded Project Introduction Panel (6 columns on desktop) */}
        <div className="hidden lg:flex lg:col-span-6 relative m-3 rounded-[22px] overflow-hidden select-none border border-indigo-400/20 bg-gradient-to-br from-[#4f46e5] via-[#3730a3] to-[#1e1b4b] p-10 xl:p-12 flex-col justify-between shadow-inner">
          {/* Subtle Top-Right Cyan Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-400/15 blur-3xl pointer-events-none" />

          {/* Subtle Geometric Contour Lines SVG (matching reference aesthetic) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
            viewBox="0 0 600 700"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 180 -40 C 260 220, 320 440, 260 740"
              stroke="#ffffff"
              strokeOpacity="0.24"
              strokeWidth="1.5"
            />
            <path
              d="M 310 -40 C 380 220, 430 440, 370 740"
              stroke="#22d3ee"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
            <path
              d="M 430 -40 C 490 220, 540 440, 480 740"
              stroke="#ffffff"
              strokeOpacity="0.22"
              strokeWidth="1.5"
            />
            <path
              d="M -40 290 L 520 60 L 640 500"
              stroke="#ffffff"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
            <path
              d="M -40 420 L 570 175 L 660 560"
              stroke="#22d3ee"
              strokeOpacity="0.20"
              strokeWidth="1.5"
            />
          </svg>

          {/* Top Emblem Icon */}
          <div className="relative z-10">
            <svg
              className="w-12 h-12 text-white"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M24 6V42M6 24H42M11.27 11.27L36.73 36.73M36.73 11.27L11.27 36.73"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Center Hero Greeting & Project Explanation */}
          <div className="relative z-10 my-auto py-8">
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Hello
              <br />
              AssetVault! <span className="inline-block">👋</span>
            </h2>
            <p className="mt-6 text-base xl:text-[17px] text-indigo-100/95 leading-relaxed max-w-[400px] font-normal">
              Skip repetitive and manual asset-licensing spreadsheets. Centralize your digital assets, automate seat allocations, and stay audit-ready while saving tons of time!
            </p>
          </div>

          {/* Bottom Copyright Footer */}
          <div className="relative z-10 text-xs text-indigo-200/75 font-medium">
            &copy; {new Date().getFullYear()} AssetVault. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
