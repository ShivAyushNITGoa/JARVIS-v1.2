'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(`Authentication error: ${error.message}`);
        setTimeout(() => router.push('/'), 3000);
      } else if (data.session) {
        setMessage('Authentication successful! Redirecting...');
        setTimeout(() => router.push('/'), 1500);
      } else {
        // Handle magic link confirmation
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setMessage(`Error setting session: ${error.message}`);
          } else {
            setMessage('Email confirmed! You are now signed in.');
            setTimeout(() => router.push('/'), 1500);
          }
        } else {
          setMessage('No session found. Redirecting to login...');
          setTimeout(() => router.push('/'), 3000);
        }
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
      <div className="glass p-8 rounded-2xl max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>{message}</p>
      </div>
    </div>
  );
}
