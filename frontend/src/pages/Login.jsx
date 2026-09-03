import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, Lock, User, Phone, LogIn, UserPlus, ArrowLeft, KeyRound } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { api } from '../utils/api.js';

export default function Login() {
  const { login, signup, isAuthenticated, isAdminOrStaff, error: authError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getErrorMessage = (errStr) => {
    if (!errStr) return '';
    const lower = errStr.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('too many requests')) {
      return 'Too many verification emails requested. Please wait before requesting another code.';
    }
    return errStr;
  };

  const navigate = useNavigate();
  const location = useLocation();

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

  // Handle resend OTP countdown cooldown
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setTimeout(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (verificationCode.length !== 6) {
        throw new Error('Verification code must be exactly 6 digits');
      }
      const res = await api.post('/auth/verify-otp', { email, token: verificationCode });
      
      const sessionData = res.data;
      if (sessionData?.session?.accessToken) {
        api.setToken(sessionData.session.accessToken);
        window.location.href = '/';
      } else {
        throw new Error('Verification succeeded but failed to establish session.');
      }
    } catch (err) {
      console.error('OTP verification failed:', err.message);
      setError(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/resend-otp', { email });
      setSuccess(res.message || 'Verification code resent successfully.');
      setCooldown(60);
    } catch (err) {
      console.error('OTP resend failed:', err.message);
      setError(err.message || 'Failed to resend verification code');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!email) {
          throw new Error('Email is required');
        }
        const res = await api.post('/auth/password-reset', { email });
        setSuccess(res.message || 'Reset email sent successfully. Please check your inbox.');
      } else if (isRegister) {
        if (!firstName) {
          throw new Error('First name is required');
        }
        const signUpData = await signup(email, password, firstName, lastName, phone);
        
        if (signUpData?.session) {
          // Already verified (e.g. email confirmations disabled globally)
          api.setToken(signUpData.session.accessToken);
          window.location.href = '/';
        } else {
          // Verification OTP required
          setIsVerifying(true);
          setCooldown(60);
          setSuccess('Account created! Please verify your email with the 6-digit code sent.');
        }
      } else {
        try {
          await login(email, password);
        } catch (err) {
          if (err.message && err.message.toLowerCase().includes('verify')) {
            setIsVerifying(true);
            setCooldown(60);
            setSuccess('Please verify your email with the 6-digit code.');
            return;
          }
          throw err;
        }
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
      <div className="flex-grow flex items-center justify-center p-6 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          
          {isVerifying ? (
            <div className="p-4 border-b border-gray-850">
              <button
                type="button"
                onClick={() => {
                  setIsVerifying(false);
                  setError('');
                  setSuccess('');
                }}
                className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : isForgotPassword ? (
            <div className="p-4 border-b border-gray-850">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : (
            /* Header tabs */
            <div className="flex border-b border-gray-850">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                  !isRegister
                    ? 'border-amber-500 text-amber-500 bg-gray-850/30'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
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
                    ? 'border-amber-500 text-amber-500 bg-gray-850/30'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>
          )}

          <form onSubmit={isVerifying ? handleVerifyOtp : handleSubmit} className="p-8 space-y-6">
            <h2 className="text-2xl font-extrabold text-center tracking-tight text-white">
              {isVerifying ? 'Verify Your Email' : isForgotPassword ? 'Reset Password' : isRegister ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            {isVerifying && (
              <p className="text-xs text-gray-400 text-center">
                We've sent a 6-digit verification code to <span className="text-white font-medium">{email}</span>. Please enter it below.
              </p>
            )}

            {/* Error alerts */}
            {(error || authError) && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg text-center font-medium">
                {getErrorMessage(error || authError)}
              </div>
            )}

            {/* Success alerts */}
            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-center font-medium">
                {success}
              </div>
            )}

            <div className="space-y-4">
              {isVerifying ? (
                /* OTP Verification Field */
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 text-center block">6-Digit Verification Code</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors text-center font-bold text-lg tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                </div>
              ) : isForgotPassword ? (
                /* Email for Forgot Password */
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
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
                          <label className="text-xs font-semibold text-gray-400">First Name *</label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              required
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                              placeholder="Vikram"
                            />
                          </div>
                        </div>

                        {/* Last Name */}
                        <div className="flex-1 space-y-1.5">
                          <label className="text-xs font-semibold text-gray-400">Last Name</label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                              placeholder="Rao"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="+91 9900998888"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-400">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                          setSuccess('');
                        }}
                        className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
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
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
              ) : (
                <>
                  {isVerifying ? (
                    <span>Verify Code</span>
                  ) : isForgotPassword ? (
                    <>
                      <KeyRound className="w-5 h-5" />
                      <span>Send Reset Link</span>
                    </>
                  ) : isRegister ? (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Sign Up</span>
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



            {isVerifying && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={handleResendOtp}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-400 disabled:text-gray-600 transition-colors"
                >
                  {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Verification Code'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </BaseLayout>
  );
}
