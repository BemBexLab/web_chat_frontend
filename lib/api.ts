export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiCall<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof fetchOptions.headers === 'object' && fetchOptions.headers !== null && !Array.isArray(fetchOptions.headers)) {
    if (fetchOptions.headers instanceof Headers) {
      fetchOptions.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, fetchOptions.headers);
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}

// Admin API calls
export const adminApi = {
  login: (email: string, password: string) =>
    apiCall('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string) =>
    apiCall('/admin/logout', {
      method: 'POST',
      token,
    }),

  getUsers: (token: string) =>
    apiCall('/admin/users', {
      method: 'GET',
      token,
    }),

  getUserById: (token: string, userId: string) =>
    apiCall(`/admin/users/${userId}`, {
      method: 'GET',
      token,
    }),

  createUser: (
    token: string,
    data: { email: string; password: string; username: string }
  ) =>
    apiCall('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateUser: (
    token: string,
    userId: string,
    data: { email?: string; username?: string; isActive?: boolean; suspended?: boolean }
  ) =>
    apiCall(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  deleteUser: (token: string, userId: string) =>
    apiCall(`/admin/users/${userId}`, {
      method: 'DELETE',
      token,
    }),

  updateUserPassword: (token: string, userId: string, newPassword: string) =>
    apiCall(`/admin/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
      token,
    }),
};

// User API calls
export const userApi = {
  login: (email: string, password: string) =>
    apiCall('/user/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string) =>
    apiCall('/user/logout', {
      method: 'POST',
      token,
    }),

  getProfile: (token: string) =>
    apiCall('/user/profile', {
      method: 'GET',
      token,
    }),

  updateProfile: (token: string, data: { username: string }) =>
    apiCall('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  changePassword: (
    token: string,
    currentPassword: string,
    newPassword: string
  ) =>
    apiCall('/user/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
      token,
    }),
};
