'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from './userAuthContext';

export function useUserProtectedRoute() {
  const { token, isLoading } = useUserAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/user/login');
    }
  }, [token, isLoading, router]);

  return { isLoading, isAuthenticated: !!token };
}
