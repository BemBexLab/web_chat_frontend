'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUserAuth } from '@/lib/userAuthContext';
import { useUserProtectedRoute } from '@/lib/useUserProtectedRoute';

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useUserProtectedRoute();
  const { user, logout } = useUserAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push('/user/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-[529px] flex items-center justify-center bg-gray-50">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold">User</h1>
          <p className="text-sm text-slate-400 mt-1">Portal</p>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          {(() => {
            const links = [
              { href: '/user/dashboard', label: 'Dashboard', icon: '📊' },
              { href: '/user/profile', label: 'Profile', icon: '👤' },
              { href: '/user/chat', label: 'Chat', icon: '💬' },
            ];
            return links.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              );
            });
          })()}
        </nav>

        <div className="p-6 border-t border-slate-700">
          {user && (
            <>
              <p className="text-xs text-slate-400 mb-2">Logged in as</p>
              <p className="text-sm font-medium break-all mb-4">{user.email}</p>
            </>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="px-4">{children}</div>
      </main>
    </div>
  );
}
