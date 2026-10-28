// ==============================================================================
// AssetVault: Clean Split-Card Multi-Step Tenant Registration Page
// Multi-step wizard inside matching split-card container:
// Step 1: Organization name + auto-derived slug + contact email
// Step 2: Administrator name + email + password with 5-segment strength meter
// Fully validated with React Hook Form & Zod matching auth.validator.ts
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthAmbientBackground } from './AuthAmbientBackground';
import {
  Building2,
  Globe,
  Mail,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../utils/cn';

// ==============================================================================
// Zod Schemas Matching backend/src/validators/auth.validator.ts
// ==============================================================================

export const passwordStrengthRegex = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
};

export const registerTenantSchema = z.object({
  tenantName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name cannot exceed 100 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase alphanumeric characters and hyphens')
    .trim(),
  contactEmail: z
    .string()
    .email('Valid organization contact email is required')
    .toLowerCase()
    .trim(),
  adminFullName: z
    .string()
    .min(2, 'Administrator full name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  adminEmail: z
    .string()
    .email('Valid administrator email is required')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(passwordStrengthRegex.upper, 'Password must contain at least one uppercase letter')
    .regex(passwordStrengthRegex.lower, 'Password must contain at least one lowercase letter')
    .regex(passwordStrengthRegex.digit, 'Password must contain at least one numeric digit')
    .regex(passwordStrengthRegex.symbol, 'Password must contain at least one special symbol'),
});

export type RegisterFormData = z.infer<typeof registerTenantSchema>;

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ==============================================================================
// Main RegisterPage Component
// ==============================================================================

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerTenantSchema),
    mode: 'onChange',
    shouldUnregister: false,
    defaultValues: {
      tenantName: '',
      slug: '',
      contactEmail: '',
      adminFullName: '',
      adminEmail: '',
      password: '',
    },
  });

  const tenantNameValue = watch('tenantName');
  const passwordValue = watch('password') || '';
  const contactEmailValue = watch('contactEmail');

  // Auto-derive slug from tenantName unless user manually typed in slug
  useEffect(() => {
    if (!isSlugManual && tenantNameValue) {
      const derived = slugify(tenantNameValue);
      setValue('slug', derived, { shouldValidate: true });
    }
  }, [tenantNameValue, isSlugManual, setValue]);

  // Sync contact email to admin email if admin email is empty
  const handleStep1Next = async () => {
    const isStep1Valid = await trigger(['tenantName', 'slug', 'contactEmail']);
    if (isStep1Valid) {
      const currentAdminEmail = watch('adminEmail');
      if (!currentAdminEmail && contactEmailValue) {
        setValue('adminEmail', contactEmailValue);
      }
      setStep(2);
      setServerError(null);
    }
  };

  // 5-Segment Password Strength Rules
  const passwordRules = useMemo(() => {
    const p = passwordValue;
    return [
      { id: 'min10', label: 'At least 10 characters', met: p.length >= 10 },
      { id: 'upper', label: 'One uppercase letter (A-Z)', met: passwordStrengthRegex.upper.test(p) },
      { id: 'lower', label: 'One lowercase letter (a-z)', met: passwordStrengthRegex.lower.test(p) },
      { id: 'digit', label: 'One numeric digit (0-9)', met: passwordStrengthRegex.digit.test(p) },
      { id: 'symbol', label: 'One special symbol (!@#$...)', met: passwordStrengthRegex.symbol.test(p) },
    ];
  }, [passwordValue]);

  const satisfiedCount = useMemo(() => {
    return passwordRules.filter((r) => r.met).length;
  }, [passwordRules]);

  // Color mapping: Deep Navy Slate / Royal Indigo / Cyan / Emerald progression
  const strengthColorClass = useMemo(() => {
    if (satisfiedCount <= 1) return 'bg-rose-500';
    if (satisfiedCount === 2) return 'bg-amber-500';
    if (satisfiedCount <= 4) return 'bg-indigo-500';
    return 'bg-cyan-400';
  }, [satisfiedCount]);

  const strengthLabel = useMemo(() => {
    if (!passwordValue) return 'Enter password';
    if (satisfiedCount <= 1) return 'Weak';
    if (satisfiedCount === 2) return 'Fair';
    if (satisfiedCount <= 4) return 'Good';
    return 'Strong';
  }, [passwordValue, satisfiedCount]);

  const onInvalid = (fieldErrors: any) => {
    if (fieldErrors.tenantName || fieldErrors.slug || fieldErrors.contactEmail) {
      setStep(1);
      const msg =
        fieldErrors.tenantName?.message ||
        fieldErrors.slug?.message ||
        fieldErrors.contactEmail?.message;
      setServerError(`Step 1: ${msg}`);
      toast.error(msg, 'Please check Step 1 fields');
    } else {
      const msg =
        fieldErrors.adminFullName?.message ||
        fieldErrors.adminEmail?.message ||
        fieldErrors.password?.message;
      setServerError(msg || 'Please resolve the highlighted validation errors.');
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      await registerAuth({
        tenantName: data.tenantName,
        tenantSlug: data.slug,
        fullName: data.adminFullName,
        email: data.adminEmail,
        contactEmail: data.contactEmail,
        password: data.password,
      });

      toast.success(
        `Organization ${data.tenantName} and Master Admin provisioned successfully!`,
        'Welcome to AssetVault'
      );
      navigate('/');
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to register organization.';
      if (err.details?.fieldErrors) {
        const fieldKeys = Object.keys(err.details.fieldErrors);
        if (fieldKeys.length > 0) {
          const firstKey = fieldKeys[0];
          const messages = err.details.fieldErrors[firstKey];
          if (Array.isArray(messages) && messages.length > 0) {
            errorMsg = `${firstKey}: ${messages[0]}`;
          }
        }
      }
      setServerError(errorMsg);
      toast.error(errorMsg, 'Registration Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#030712] text-slate-100 overflow-hidden">
      {/* Full-Viewport Ambient Background */}
      <AuthAmbientBackground />

      {/* Main Split-Card Container */}
      <div className="relative z-10 w-full max-w-[1060px] min-h-[620px] rounded-[28px] bg-[#0b1120]/95 backdrop-blur-2xl border border-slate-800/80 shadow-[0_32px_120px_-24px_rgba(2,6,23,0.95)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 animate-fade-in items-stretch">
        {/* LEFT COLUMN: 2-Step Registration Wizard (6 columns on desktop) */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-11 flex flex-col justify-between relative z-10">
          <div>
            {/* Top Brand Identity */}
            <div className="mb-6">
              <Link to="/login" className="inline-flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#3730a3] text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/30 transition-transform shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold text-white tracking-tight">
                  Asset<span className="text-indigo-400">Vault</span>
                </span>
              </Link>
            </div>

            {/* Wizard Header & Progress Bar */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                    Register Organization
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {step === 1
                      ? 'Step 1 of 2: Organization Profile & Workspace'
                      : 'Step 2 of 2: Lead Administrator & Credentials'}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[#030712] border border-slate-800 text-indigo-300 tabular-nums shrink-0">
                  Step {step} / 2
                </span>
              </div>

              {/* Top Progress Bar Track */}
              <div className="w-full bg-[#131c31] rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-300 ease-out',
                    step === 1 ? 'w-1/2' : 'w-full'
                  )}
                />
              </div>

              {/* Step Breadcrumb Indicators */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    'flex items-center gap-1.5 font-semibold transition-colors cursor-pointer',
                    step === 1
                      ? 'text-indigo-300'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                      step === 2
                        ? 'bg-indigo-950 text-cyan-300 border border-indigo-700/50'
                        : 'bg-indigo-600 text-white'
                    )}
                  >
                    {step === 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                  </span>
                  <span>Organization</span>
                </button>

                <div className="w-12 h-px bg-slate-800" />

                <div
                  className={cn(
                    'flex items-center gap-1.5 font-semibold',
                    step === 2 ? 'text-indigo-300' : 'text-slate-500'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                      step === 2
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#131c31] text-slate-400 border border-slate-800'
                    )}
                  >
                    2
                  </span>
                  <span>Administrator</span>
                </div>
              </div>
            </div>

            {/* Server Error Alert */}
            {serverError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
              {/* ================================================================ */}
              {/* STEP 1: ORGANIZATION DETAILS                                      */}
              {/* ================================================================ */}
              <div className={cn('space-y-4 animate-fade-in', step !== 1 && 'hidden')}>
                <div>
                  <Input
                    label="Organization / Company Name"
                    type="text"
                    placeholder="Acme Innovations, Inc."
                    iconLeft={<Building2 className="w-4 h-4 text-slate-400" />}
                    error={errors.tenantName?.message}
                    {...register('tenantName')}
                  />
                </div>

                <div>
                  <Input
                    label="Workspace URL Slug"
                    type="text"
                    placeholder="acme-innovations"
                    helperText="Unique tenant identifier used for tenant isolation and routing"
                    iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
                    error={errors.slug?.message}
                    {...register('slug', {
                      onChange: () => setIsSlugManual(true),
                    })}
                  />
                </div>

                <div>
                  <Input
                    label="Organization Contact Email"
                    type="email"
                    placeholder="contact@acme.com"
                    helperText="Official billing & operational contact email"
                    iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                    error={errors.contactEmail?.message}
                    {...register('contactEmail')}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleStep1Next}
                  className="w-full mt-2 font-semibold shadow-lg shadow-indigo-600/25"
                  iconRight={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Admin Setup
                </Button>
              </div>

              {/* ================================================================ */}
              {/* STEP 2: LEAD ADMINISTRATOR & PASSWORD WITH STRENGTH METER         */}
              {/* ================================================================ */}
              <div className={cn('space-y-4 animate-fade-in', step !== 2 && 'hidden')}>
                <div>
                  <Input
                    label="Lead Administrator Full Name"
                    type="text"
                    placeholder="Jane Doe"
                    iconLeft={<User className="w-4 h-4 text-slate-400" />}
                    error={errors.adminFullName?.message}
                    {...register('adminFullName')}
                  />
                </div>

                <div>
                  <Input
                    label="Administrator Work Email"
                    type="email"
                    placeholder="admin@company.com"
                    helperText="Your personal admin login credentials"
                    iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                    error={errors.adminEmail?.message}
                    {...register('adminEmail')}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    label="Master Administrator Password"
                    type="password"
                    placeholder="Min 10 chars, uppercase, symbol..."
                    iconLeft={<Lock className="w-4 h-4 text-slate-400" />}
                    error={errors.password?.message}
                    {...register('password')}
                  />

                  {/* 5-Segment Password Strength Meter */}
                  <div className="p-3 rounded-xl bg-[#030712] border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Password Strength:</span>
                      <span className="font-bold text-[11px] font-mono tabular-nums text-cyan-300">
                        {strengthLabel} ({satisfiedCount}/5)
                      </span>
                    </div>

                    {/* 5 Discrete Segments */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((index) => {
                        const isFilled = index <= satisfiedCount;
                        return (
                          <div
                            key={index}
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-200',
                              isFilled ? strengthColorClass : 'bg-slate-800'
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Criteria Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      {passwordRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={cn(
                            'flex items-center gap-1.5 transition-colors',
                            rule.met ? 'text-slate-200 font-medium' : 'text-slate-500'
                          )}
                        >
                          <CheckCircle2
                            className={cn(
                              'w-3.5 h-3.5 shrink-0',
                              rule.met ? 'opacity-100 text-cyan-400' : 'opacity-30 text-slate-600'
                            )}
                          />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Back & Submit Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setStep(1)}
                    className="flex-1"
                    iconLeft={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="flex-2 font-semibold shadow-lg shadow-indigo-600/25"
                    isLoading={isLoading}
                    loadingText="Provisioning..."
                    iconRight={<Check className="w-4 h-4" />}
                  >
                    Create Organization
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Link to Sign In */}
          <div className="pt-5 mt-5 text-xs text-slate-400 border-t border-slate-800/80">
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="font-semibold text-indigo-400 hover:text-cyan-300 hover:underline transition-colors"
            >
              Sign In &rarr;
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Branded Project Introduction Panel (6 columns on desktop) */}
        <div className="hidden lg:flex lg:col-span-6 relative m-3 rounded-[22px] overflow-hidden select-none border border-indigo-400/20 bg-gradient-to-br from-[#4f46e5] via-[#3730a3] to-[#1e1b4b] p-10 xl:p-12 flex-col justify-between shadow-inner">
          {/* Subtle Top-Right Cyan Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-400/15 blur-3xl pointer-events-none" />

          {/* Subtle Geometric Contour Lines SVG */}
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

export default RegisterPage;
