'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthGate({ children }) {
  const { user, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <>
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => {
              signOut();
              setMessage('');
            }}
            className="btn-secondary"
          >
            Sign Out
          </button>
        </div>
        {children}
      </>
    );
  }

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setMessage('');
    try {
      await signIn(email);
      setMessage('Magic link sent! Check your email.');
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="glass p-8 rounded-2xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Welcome to JARVIS</h2>
        <p className="mb-6 text-white/70">Sign in with a magic link (no password).</p>
        <form onSubmit={handleSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
            required
            disabled={busy}
          />
          <button type="submit" disabled={busy || !email} className="btn-primary w-full">
            {busy ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-blue-400">{message}</p>}
      </div>
    </div>
  );
}
