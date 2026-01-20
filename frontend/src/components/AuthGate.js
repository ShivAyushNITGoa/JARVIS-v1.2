'use client';

import { useAuth } from '../contexts/AuthContext';
import AuthForms from './AuthForms';

export default function AuthGate({ children }) {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
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
            onClick={() => signOut()}
            className="btn-secondary"
          >
            Sign Out
          </button>
        </div>
        {children}
      </>
    );
  }

  return <AuthForms />;
}
