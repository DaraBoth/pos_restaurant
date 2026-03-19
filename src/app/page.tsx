'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/pos');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-dark)' }}>
      <div className="text-center">
        <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading DineOS...</p>
      </div>
    </div>
  );
}
