'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/authContext';
import { adminApi } from '@/lib/api';

interface User {
  _id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchStats = async () => {
      try {
        const response = await adminApi.getUsers(token) as any;
        const users: User[] = response.users || [];
        setStats({
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.isActive).length,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to the admin portal</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Total Users Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Users</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="text-4xl">👥</div>
              </div>
            </div>

            {/* Active Users Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Active Users</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">
                    {stats.activeUsers}
                  </p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/admin/dashboard/users"
              className="block p-3 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            >
              → Manage Users
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
