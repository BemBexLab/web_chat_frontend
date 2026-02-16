'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useUserAuth } from '@/lib/userAuthContext';

export default function Home() {
  const { token: adminToken } = useAuth();
  const { token: userToken } = useUserAuth();
  const router = useRouter();

  useEffect(() => {
    if (adminToken) {
      router.push('/admin/dashboard');
    } else if (userToken) {
      router.push('/user/dashboard');
    }
  }, [adminToken, userToken, router]);

  // If already logged in, show loading
  if (adminToken || userToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">Chat Web Portal</h1>
          <p className="text-xl text-gray-300">
            Manage your account or administer the system
          </p>
        </div>

        {/* Portal Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Admin Portal */}
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden hover:shadow-3xl transition">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-8 text-white">
              <div className="text-5xl mb-4">🔐</div>
              <h2 className="text-3xl font-bold">Admin Portal</h2>
            </div>
            <div className="p-8">
              <p className="text-gray-600 mb-6">
                Manage users, view statistics, and control the system
              </p>
              <ul className="space-y-2 mb-8 text-gray-700">
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3">✓</span>
                  Manage users (CRUD)
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3">✓</span>
                  View statistics
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-600 mr-3">✓</span>
                  Reset passwords
                </li>
              </ul>
              <Link
                href="/admin/login"
                className="w-full block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Admin Login
              </Link>
            </div>
          </div>

          {/* User Portal */}
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden hover:shadow-3xl transition">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-8 text-white">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="text-3xl font-bold">User Portal</h2>
            </div>
            <div className="p-8">
              <p className="text-gray-600 mb-6">
                Access your account and manage your profile
              </p>
              <ul className="space-y-2 mb-8 text-gray-700">
                <li className="flex items-center">
                  <span className="text-green-600 mr-3">✓</span>
                  View profile
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3">✓</span>
                  Update settings
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-3">✓</span>
                  Change password
                </li>
              </ul>
              <Link
                href="/user/login"
                className="w-full block text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                User Login
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-400">
          <p className="text-sm">
            Having trouble? Contact your administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
