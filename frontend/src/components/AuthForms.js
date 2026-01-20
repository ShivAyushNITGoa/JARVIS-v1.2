'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthForms() {
  const [mode, setMode] = useState('login'); // login, signup, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp, signInWithPassword, signInWithOAuth, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (mode === 'login') {
        if (password) {
          await signInWithPassword(email, password);
          setMessage('Logged in!');
        } else {
          await signIn(email);
          setMessage('Magic link sent! Check your email.');
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await signUp(email, password, { data: { display_name: name } });
        setMessage('Signup successful! Check your email to verify.');
      } else if (mode === 'reset') {
        await resetPassword(email);
        setMessage('Password reset link sent! Check your email.');
      }
    } catch (err) {
      setMessage(err.message || 'An error occurred.');
    }
    setBusy(false);
  };

  const handleOAuth = async (provider) => {
    setBusy(true);
    setMessage('');
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setMessage(err.message || 'OAuth login failed.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
      <div className="glass p-8 rounded-2xl max-w-md w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-center">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'reset' && 'Reset Password'}
          </h2>
          <p className="text-center text-white/70 mt-2">
            {mode === 'login' && 'Sign in to access JARVIS'}
            {mode === 'signup' && 'Join JARVIS to get started'}
            {mode === 'reset' && 'Enter your email to reset your password'}
          </p>
        </div>

        {/* OAuth Buttons */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth('google')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuth('github')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-jarvis-dark text-white/70">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
              required={mode === 'signup'}
              disabled={busy}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
            required
            disabled={busy}
          />
          {(mode === 'login' || mode === 'signup') && (
            <input
              type="password"
              placeholder={mode === 'login' ? 'Password (optional, use magic link if empty)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
              required={mode === 'signup'}
              disabled={busy}
            />
          )}
          {mode === 'signup' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
              required
              disabled={busy}
            />
          )}
          <button
            type="submit"
            disabled={busy || (mode === 'signup' && password !== confirmPassword)}
            className="w-full btn-primary"
          >
            {busy
              ? (mode === 'login' && 'Signing in...') ||
                (mode === 'signup' && 'Creating account...') ||
                (mode === 'reset' && 'Sending reset link...')
              : (mode === 'login' && 'Sign In') ||
                (mode === 'signup' && 'Sign Up') ||
                (mode === 'reset' && 'Send Reset Link')}
          </button>
        </form>

        {message && (
          <p className={`text-sm text-center ${message.includes('error') ? 'text-red-400' : 'text-blue-400'}`}>
            {message}
          </p>
        )}

        <div className="text-center space-y-2 text-sm">
          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-blue-400 hover:underline"
              >
                Forgot password?
              </button>
              <p>
                No account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-blue-400 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-blue-400 hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-blue-400 hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
