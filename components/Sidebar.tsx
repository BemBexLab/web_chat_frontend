'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    // redirect to admin login page (useProtectedRoute will also redirect when token is null)
    router.push('/admin/login');
  };

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/dashboard/users', label: 'Users', icon: '👥' },
    { href: '/admin/dashboard/chat', label: 'Chat', icon: '💬' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      {/* Logo/Title */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-slate-400 mt-1">Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navItems.map((item) => {
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
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-6 border-t border-slate-700">
        {admin && (
          <>
            <p className="text-xs text-slate-400 mb-2">Logged in as</p>
            <p className="text-sm font-medium break-all mb-4">{admin.email}</p>
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
  );
}
