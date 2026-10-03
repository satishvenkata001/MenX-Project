import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, Lock, User, Phone, LogIn, Send, ArrowLeft, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { api } from '../utils/api.js';

export default function Login() {
  const { login, signup, verifyOtp, resendOtp, refreshUser, isAuthenticated, isAdminOrStaff, error: authError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const otpInputRef = useRef(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const getErrorMessage = (errStr) => {
    if (!errStr) return '';
    const lower = errStr.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('too many requests')) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    return errStr;
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (isAdminOrStaff) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, isAdminOrStaff, navigate, location]);

  // Handle forgot password request via route state or query param
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (location.state?.forgot || searchParams.get('action') === 'forgot-password' || searchParams.get('forgot') === 'true') {
      setIsForgotPassword(true);
      setIsRegister(false);
      setIsVerifyingOtp(false);
      if (searchParams.get('action') === 'forgot-password' || searchParams.get('forgot') === 'true') {
        searchParams.delete('action');
        searchParams.delete('forgot');
        const newSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
        window.history.replaceState({}, document.title, location.pathname + newSearch);
      }
    }
  }, [location]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer;
    if (isVerifyingOtp && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isVerifyingOtp, resendCooldown]);

  // Auto-focus OTP input when entering verification state
  useEffect(() => {
    if (isVerifyingOtp) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [isVerifyingOtp]);

  // Handle incoming Supabase Code exchange if present
  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        if (code) {
          try {
            const res = await api.post('/auth/exchange-code', { code });
            if (res.data?.session?.accessToken) {
              api.setToken(res.data.session.accessToken);
              await refreshUser();
              navigate('/');
              return;
            }
          } catch (exchangeErr) {
            console.error('Failed to exchange code:', exchangeErr.message);
            setError('Authentication session could not be verified. Please sign in.');
          } finally {
            window.history.replaceState({}, document.title, location.pathname);
          }
        }
      } catch (err) {
        console.error('Callback handling error:', err.message);
      }
    }

    handleAuthCallback();
  }, [location, navigate, refreshUser]);

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpToken(val);
    if (error) setError('');
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpToken.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await verifyOtp(email.trim(), otpToken.trim());
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (isAdminOrStaff) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('OTP verification failed:', err.message);
      setError(err.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resending) return;
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const res = await resendOtp(email.trim());
      setResendCooldown(60);
      setSuccess(res?.message || 'Verification code resent successfully. Please check your inbox.');
      otpInputRef.current?.focus();
    } catch (err) {
      console.error('Resend OTP failed:', err.message);
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        // Forgot Password Flow
        if (!email.trim()) {
          throw new Error('Email is required');
        }
        const res = await api.post('/auth/password-reset', { email: email.trim() });
        setSuccess(
          res.data?.message ||
          res.message ||
          'If an account with this email exists, a password reset link has been sent.'
        );
      } else if (isRegister) {
        // Customer Registration Flow
        if (!firstName.trim()) {
          throw new Error('First name is required');
        }
        if (!phone.trim()) {
          throw new Error('Mobile number is required');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        await signup(
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim() || null,
          phone.trim() || null
        );

        // Transition to OTP verification state
        setIsVerifyingOtp(true);
        setOtpToken('');
        setResendCooldown(60);
        setPassword('');
        setError('');
        setSuccess('A 6-digit verification code has been sent to your email.');
      } else {
        // Standard Email + Password Sign In Flow
        await login(email.trim(), password);
      }
    } catch (err) {
      console.error('Authentication action failed:', err.message);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseLayout>
      <div className="flex-grow flex items-center justify-center p-6 bg-menx-bg">
        <div className="w-full max-w-md menx-card rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header Navigation / Tabs */}
          {isForgotPassword ? (
            <div className="p-4 border-b border-menx-border">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccess('');
                  navigate('/login', { replace: true, state: {} });
                }}
                className="flex items-center space-x-2 text-xs font-semibold text-menx-text-secondary hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : isVerifyingOtp ? (
            <div className="p-4 border-b border-menx-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsVerifyingOtp(false);
                  setIsRegister(true);
                  setOtpToken('');
                  setError('');
                  setSuccess('');
                }}
                className="flex items-center space-x-2 text-xs font-semibold text-menx-text-secondary hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Registration</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVerifyingOtp(false);
                  setIsRegister(false);
                  setOtpToken('');
                  setError('');
                  setSuccess('');
                }}
                className="text-xs font-semibold text-menx-text-muted hover:text-menx-primary transition-colors"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="flex border-b border-menx-border">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                  !isRegister
                    ? 'border-menx-primary text-menx-primary bg-menx-surface-elevated/30'
                    : 'border-transparent text-menx-text-secondary hover:text-menx-text'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                  isRegister
                    ? 'border-menx-primary text-menx-primary bg-menx-surface-elevated/30'
                    : 'border-transparent text-menx-text-secondary hover:text-menx-text'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* OTP Verification Screen */}
          {isVerifyingOtp ? (
            <form onSubmit={handleVerifyOtp} className="p-8 space-y-6">
              {/* Card Header Title */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-menx-primary/10 border border-menx-primary/20 rounded-2xl flex items-center justify-center mx-auto text-menx-primary mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  Verify Your Email
                </h2>
                <p className="text-xs text-menx-text-secondary leading-relaxed">
                  Enter the 6-digit code sent to{' '}
                  <span className="text-white font-bold break-all">{email}</span>
                </p>
              </div>

              {/* Error alerts */}
              {(error || authError) && (
                <div className="p-3 bg-menx-error/10 border border-menx-error/20 text-menx-error text-xs rounded-lg font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{getErrorMessage(error || authError)}</span>
                </div>
              )}

              {/* Success alerts */}
              {success && (
                <div className="p-3 bg-menx-success/10 border border-menx-success/20 text-menx-success text-xs rounded-lg text-center font-medium flex items-center justify-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* 6-Digit Numeric OTP Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-menx-text-secondary flex justify-between items-center">
                    <span>Verification Code</span>
                    <span className="text-[10px] text-menx-text-muted uppercase tracking-wider font-mono">
                      {otpToken.length}/6 digits
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otpToken}
                      onChange={handleOtpChange}
                      placeholder="••••••"
                      className="w-full bg-menx-bg border border-menx-border rounded-xl py-3 px-4 text-center font-mono text-2xl tracking-[0.4em] font-extrabold text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary transition-all select-all"
                    />
                  </div>
                </div>

                {/* Resend Code Section */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-menx-text-muted">Didn't receive code?</span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || resending}
                    onClick={handleResendCode}
                    className="font-bold text-menx-primary hover:text-menx-primary-hover disabled:text-menx-text-muted disabled:cursor-not-allowed transition-colors"
                  >
                    {resending
                      ? 'Sending...'
                      : resendCooldown > 0
                      ? `Resend Code in ${resendCooldown}s`
                      : 'Resend Code'}
                  </button>
                </div>
              </div>

              {/* Verify & Sign In Button */}
              <button
                type="submit"
                disabled={loading || otpToken.length !== 6}
                className="w-full py-3 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify &amp; Sign In</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Card Header Title */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  {isForgotPassword
                    ? 'Reset Password'
                    : isRegister
                    ? 'Create Your Account'
                    : 'Welcome Back'}
                </h2>
                <p className="text-xs text-menx-text-secondary">
                  {isForgotPassword
                    ? 'Enter your email to receive a password reset link.'
                    : isRegister
                    ? 'Fill in your details to create your MENX account.'
                    : 'Sign in to access your orders, wishlist, and profile.'}
                </p>
              </div>

              {/* Error alerts */}
              {(error || authError) && (
                <div className="p-3 bg-menx-error/10 border border-menx-error/20 text-menx-error text-xs rounded-lg font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{getErrorMessage(error || authError)}</span>
                </div>
              )}

              {/* Success alerts */}
              {success && (
                <div className="p-3 bg-menx-success/10 border border-menx-success/20 text-menx-success text-xs rounded-lg text-center font-medium flex items-center justify-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="space-y-4">
                {isForgotPassword ? (
                  /* Email for Forgot Password */
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-menx-text-secondary">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {isRegister && (
                      <>
                        <div className="flex gap-4">
                          {/* First Name */}
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-semibold text-menx-text-secondary">First Name *</label>
                            <div className="relative">
                              <User className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                              <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                                placeholder="Vikram"
                              />
                            </div>
                          </div>

                          {/* Last Name */}
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-semibold text-menx-text-secondary">Last Name</label>
                            <div className="relative">
                              <User className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                              <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                                placeholder="Rao"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Mobile Number */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-menx-text-secondary">Mobile Number *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                            <input
                              type="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                              placeholder="+91 9900998888"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Email Address */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-menx-text-secondary">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-menx-text-secondary">Password</label>
                        {!isRegister && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(true);
                              setError('');
                              setSuccess('');
                            }}
                            className="text-xs font-semibold text-menx-primary hover:underline transition-colors"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                ) : (
                  <>
                    {isForgotPassword ? (
                      <>
                        <KeyRound className="w-5 h-5" />
                        <span>Send Reset Link</span>
                      </>
                    ) : isRegister ? (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        <span>Sign In</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </BaseLayout>
  );
}
