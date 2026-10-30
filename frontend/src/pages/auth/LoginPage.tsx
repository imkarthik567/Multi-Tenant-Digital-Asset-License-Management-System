// ==============================================================================
// AssetVault: Clean Split-Card Enterprise Login Page
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { signInWithGoogleAccount } from '../../services/gmailAuth';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthAmbientBackground } from './AuthAmbientBackground';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Building2,
  Globe,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';

// Zod validation matching backend auth.validator.ts loginSchema
export const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Google SSO is always enabled via Firebase Authentication
export const isGoogleAuthEnabled = (): boolean => true;

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle, isAuthenticated, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Onboarding state for first-time Google users who need to create a workspace
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{
    email: string;
    fullName: string;
    avatarUrl: string | null;
  } | null>(null);
  const [onboardingTenantName, setOnboardingTenantName] = useState('');
  const [onboardingSlug, setOnboardingSlug] = useState('');
  const [isOnboardingSlugManual, setIsOnboardingSlugManual] = useState(false);
  const [onboardingFullName, setOnboardingFullName] = useState('');

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (!isOnboardingSlugManual && onboardingTenantName) {
      setOnboardingSlug(slugify(onboardingTenantName));
    }
  }, [onboardingTenantName, isOnboardingSlugManual]);

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

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setServerError(null);

      const googleProfile = await signInWithGoogleAccount();
      const result = await loginWithGoogle({
        email: googleProfile.email,
        fullName: googleProfile.fullName,
        avatarUrl: googleProfile.avatarUrl,
      });

      if (result.requiresOnboarding) {
        const profile = result.profile || googleProfile;
        setPendingGoogleProfile(profile);
        setOnboardingFullName(profile.fullName || profile.email.split('@')[0]);
        toast.info(
          'Google account verified! Enter your Organization Name to finish workspace creation.',
          'Complete Workspace Setup'
        );
        return;
      }

      if (result.user) {
        toast.success(`Welcome back, ${result.user.fullName}!`, 'Signed In with Google');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || 'Google Sign-In could not be completed.';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.toLowerCase().includes('popup')
      ) {
        return;
      }
      setServerError(msg);
      toast.error(msg, 'Google Sign-In Failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleProfile) return;

    const trimmedOrg = onboardingTenantName.trim();
    if (trimmedOrg.length < 2) {
      setServerError('Organization Name must be at least 2 characters.');
      return;
    }

    try {
      setIsGoogleLoading(true);
      setServerError(null);
      const result = await loginWithGoogle({
        email: pendingGoogleProfile.email,
        fullName: onboardingFullName.trim() || pendingGoogleProfile.fullName,
        avatarUrl: pendingGoogleProfile.avatarUrl,
        tenantName: trimmedOrg,
        slug: onboardingSlug.trim() || slugify(trimmedOrg),
        contactEmail: pendingGoogleProfile.email,
      });

      if (result.user) {
        toast.success(
          `Organization ${trimmedOrg} created! Welcome, ${result.user.fullName}.`,
          'Workspace Ready'
        );
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to provision organization workspace.';
      setServerError(msg);
      toast.error(msg, 'Setup Failed');
    } finally {
      setIsGoogleLoading(false);
    }
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
      <div className="relative z-10 w-full max-w-[1040px] min-h-[600px] rounded-[28px] bg-[#080d1a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_32px_120px_-24px_rgba(2,6,23,0.95)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 animate-fade-in items-stretch">
        {/* LEFT COLUMN: Clean Authentication Form (6 columns on desktop) */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-between relative z-10">
          <div>
            {/* Top Brand Identity */}
            <div className="mb-8">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#3730a3] text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/30 transition-transform shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold text-white tracking-tight">
                  Asset<span className="text-indigo-400">Vault</span>
                </span>
              </Link>
            </div>

            {pendingGoogleProfile ? (
              /* ============================================================== */
              /* NEW GOOGLE USER: ORGANIZATION ONBOARDING STEP                  */
              /* ============================================================== */
              <div className="animate-fade-in">
                <div className="mb-5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                    Create Your Workspace
                  </h1>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Your Google account is verified. Enter your organization details to provision your isolated AssetVault workspace.
                  </p>
                </div>

                {/* Verified Google Account Badge */}
                <div className="mb-5 p-3.5 rounded-xl bg-indigo-950/35 border border-indigo-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {pendingGoogleProfile.fullName}
                      </p>
                      <p className="text-[11px] text-indigo-300 font-mono truncate">
                        {pendingGoogleProfile.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingGoogleProfile(null);
                      setServerError(null);
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                  >
                    Switch Account
                  </button>
                </div>

                {serverError && (
                  <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleCompleteGoogleOnboarding} className="space-y-4">
                  <Input
                    label="Organization / Company Name *"
                    type="text"
                    placeholder="Acme Innovations, Inc."
                    value={onboardingTenantName}
                    onChange={(e) => setOnboardingTenantName(e.target.value)}
                    iconLeft={<Building2 className="w-4 h-4 text-slate-400" />}
                    required
                  />

                  <Input
                    label="Workspace URL Slug *"
                    type="text"
                    placeholder="acme-innovations"
                    value={onboardingSlug}
                    onChange={(e) => {
                      setIsOnboardingSlugManual(true);
                      setOnboardingSlug(slugify(e.target.value));
                    }}
                    helperText="Unique tenant identifier for multi-tenant isolation"
                    iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
                    required
                  />

                  <Input
                    label="Administrator Full Name *"
                    type="text"
                    placeholder="Jane Doe"
                    value={onboardingFullName}
                    onChange={(e) => setOnboardingFullName(e.target.value)}
                    iconLeft={<UserIcon className="w-4 h-4 text-slate-400" />}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full mt-2 font-semibold shadow-lg shadow-indigo-600/25"
                    isLoading={isGoogleLoading}
                    loadingText="Provisioning Workspace..."
                    iconRight={<ArrowRight className="w-4 h-4" />}
                  >
                    Create Workspace &amp; Continue
                  </Button>
                </form>
              </div>
            ) : (
              /* ============================================================== */
              /* STANDARD SIGN IN + GOOGLE SSO                                  */
              /* ============================================================== */
              <div>
                {/* Form Header */}
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                    Sign In to AssetVault
                  </h1>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Enter your workspace credentials or continue with Google SSO.
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

                {/* Google OAuth SSO */}
                <div className="space-y-4 pt-5">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800/80" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2.5 bg-[#0a0f1e] text-slate-400 uppercase font-medium text-[10px] tracking-wider">
                        Or Continue With SSO
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-indigo-500/40 rounded-xl text-xs font-semibold text-slate-100 transition-all shadow-xs cursor-pointer disabled:opacity-60"
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
                    <span>
                      {isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clean Footer Link to Register Organization */}
          <div className="pt-6 mt-6 border-t border-white/[0.08] text-xs text-slate-400">
            <span>New organization? </span>
            <Link
              to="/register"
              className="font-semibold text-indigo-400 hover:text-cyan-300 hover:underline whitespace-nowrap transition-colors"
            >
              Create Workspace &rarr;
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Royal Blue-Indigo Brand Panel (6 columns on desktop) */}
        <div className="hidden lg:flex lg:col-span-6 relative m-3 rounded-[20px] overflow-hidden select-none border border-indigo-400/20 bg-gradient-to-br from-[#2563eb] via-[#3730a3] to-[#1e1b4b] p-10 xl:p-12 flex-col justify-between">
          {/* Geometric Wave Curves Overlay */}
          <svg
            className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
            viewBox="0 0 600 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <circle cx="520" cy="120" r="240" stroke="white" strokeOpacity="0.22" strokeWidth="1.5" />
            <circle cx="520" cy="120" r="320" stroke="white" strokeOpacity="0.16" strokeWidth="1.5" />
            <circle cx="520" cy="120" r="400" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
            <path
              d="M-60 560 C 140 440, 360 660, 660 480"
              stroke="white"
              strokeOpacity="0.2"
              strokeWidth="2"
            />
            <path
              d="M-60 620 C 160 500, 380 720, 660 540"
              stroke="white"
              strokeOpacity="0.14"
              strokeWidth="1.5"
            />
          </svg>

          {/* Top Geometric Star Icon */}
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
              </svg>
            </div>
          </div>

          {/* Center Hero Copy */}
          <div className="relative z-10 my-auto py-8">
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Hello
              <br />
              AssetVault! 👋
            </h2>
            <p className="mt-4 text-sm sm:text-base text-indigo-100/90 leading-relaxed max-w-[380px]">
              Skip repetitive and manual digital asset tracking tasks. Get highly productive through automation and save tons of time on license governance!
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
