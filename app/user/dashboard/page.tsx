'use client';

import Link from 'next/link';
import UserDashboardLayout from '@/components/UserDashboardLayout';
import { useUserAuth } from '@/lib/userAuthContext';

export default function UserDashboardPage() {
  const { user } = useUserAuth();

  return (
    <UserDashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to your user portal</p>
        </div>

        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center space-x-4">
            <div className="text-5xl">👋</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.username}!
              </h2>
              <p className="text-gray-600 mt-1">Email: {user?.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Username</span>
              <span className="font-semibold text-gray-900">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Email</span>
              <span className="font-semibold text-gray-900">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Account Status</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/user/profile"
              className="block p-3 text-green-600 hover:bg-green-50 rounded-lg transition"
            >
              → Manage Profile
            </Link>
          </div>
        </div>
      </div>
    </UserDashboardLayout>
  );
}
