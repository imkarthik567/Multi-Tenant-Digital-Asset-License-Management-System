// ==============================================================================
// AssetVault: Tenant Organization Registration Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Self-service tenant creation with password strength validation
// ==============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Building2, User, Mail, Lock, Check, AlertCircle } from 'lucide-react';

const registerSchema = z.object({
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid work email'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one symbol'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const passwordVal = watch('password', '');

  // Password Strength Indicators
  const strengthChecks = [
    { label: 'At least 10 characters', met: passwordVal.length >= 10 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(passwordVal) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(passwordVal) },
    { label: 'Number (0-9)', met: /[0-9]/.test(passwordVal) },
    { label: 'Special symbol (!@#$...)', met: /[^A-Za-z0-9]/.test(passwordVal) },
  ];

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      await registerAuth({
        tenantName: data.tenantName,
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      toast.success('Your organization and admin account have been provisioned.', 'Registration Successful!');
      navigate('/');
    } catch (err: any) {
      setServerError(err.message || 'Failed to register organization.');
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-12 transition-colors">
      <div className="max-w-lg w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 shadow-lg shadow-primary-500/20 mb-3 text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Register Organization
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Start your 14-day free trial on the Free Tier &bull; No credit card required
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          {serverError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Organization / Company Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  {...register('tenantName')}
                  placeholder="Acme Innovations, Inc."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                />
              </div>
              {errors.tenantName && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.tenantName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lead Admin Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    {...register('fullName')}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="admin@company.com"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Master Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  {...register('password')}
                  placeholder="Min 10 chars, uppercase, symbol..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                />
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.password.message}</p>
              )}

              {/* Password Strength Checklist */}
              <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                {strengthChecks.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-1.5 ${
                      item.met
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <Check
                      className={`w-3.5 h-3.5 ${
                        item.met ? 'opacity-100 stroke-[3]' : 'opacity-30'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? 'Creating Tenant Organization...' : 'Create Organization & Get Started'}
            </button>
          </form>
        </div>

        {/* Existing account link */}
        <div className="text-center mt-6 text-xs text-slate-500 dark:text-slate-400">
          <span>Already have an account? </span>
          <Link
            to="/login"
            className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
          >
            Sign in &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};
