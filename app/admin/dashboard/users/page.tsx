'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/authContext';
import { adminApi } from '@/lib/api';

interface User {
  _id: string;
  email: string;
  username: string;
  isActive: boolean;
  suspended?: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch users
  useEffect(() => {
    if (!token) return;
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getUsers(token!) as any;
      setUsers(response.users || []);
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to fetch users'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.username) {
      setMessage('All fields are required');
      return;
    }

    setActionLoading(true);
    try {
      await adminApi.createUser(token!, {
        email: formData.email,
        password: formData.password,
        username: formData.username,
      });
      setMessage('User created successfully');
      setFormData({ email: '', username: '', password: '' });
      setShowCreateModal(false);
      await fetchUsers();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to create user'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoading(true);
    try {
      await adminApi.updateUser(token!, editingUser._id, {
        email: formData.email,
        username: formData.username,
        suspended: editingUser.suspended,
      });
      setMessage('User updated successfully');
      setEditingUser(null);
      setFormData({ email: '', username: '', password: '' });
      await fetchUsers();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to update user'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setActionLoading(true);
    try {
      await adminApi.deleteUser(token!, userId);
      setMessage('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to delete user'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit User
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      password: '',
    });
  };

  // Toggle suspend/unsuspend
  const handleToggleSuspend = async (user: User) => {
    if (!token) return;
    const confirmMsg = user.suspended
      ? 'Unsuspend this user? They will regain access to chat.'
      : 'Suspend this user? They will be blocked from viewing or sending messages.';
    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await adminApi.updateUser(token!, user._id, { suspended: !user.suspended });
      setMessage(user.suspended ? 'User unsuspended' : 'User suspended');
      await fetchUsers();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to update user'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setEditingUser(null);
    setFormData({ email: '', username: '', password: '' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage all users in the system</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
          >
            + Create User
          </button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.startsWith('Error')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}
          >
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">No users found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Create your first user
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.suspended
                            ? 'bg-yellow-100 text-yellow-800'
                            : user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.suspended ? 'Suspended' : user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(user)}
                        disabled={actionLoading}
                        className="text-yellow-700 hover:text-yellow-800 font-semibold"
                      >
                        {user.suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        disabled={actionLoading}
                        className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingUser ? 'Edit User' : 'Create User'}
            </h2>

            <form
              onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
