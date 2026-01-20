'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    setBusy(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Password updated successfully! Redirecting to sign in...');
      setTimeout(() => router.push('/'), 2000);
    }
    setBusy(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
        <div className="glass p-8 rounded-2xl max-w-md w-full text-center">
          <p>Invalid or missing reset token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
      <div className="glass p-8 rounded-2xl max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-4">Set New Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
            required
            disabled={busy}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 focus:outline-none focus:border-blue-400"
            required
            disabled={busy}
          />
          <button type="submit" disabled={busy} className="w-full btn-primary">
            {busy ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        {message && (
          <p className={`mt-4 text-sm text-center ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
