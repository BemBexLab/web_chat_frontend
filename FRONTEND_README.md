# Chat Web - Admin Portal Frontend

A modern Next.js frontend for the Chat Web API with admin authentication, user management dashboard, and real-time UI updates.

## 🚀 Features

- ✅ Admin login/logout with JWT authentication
- ✅ User management dashboard (CRUD operations)
- ✅ Real-time user statistics
- ✅ Responsive design with Tailwind CSS
- ✅ Protected routes with auth context
- ✅ Error handling and success messages
- ✅ Modern UI with loading states and animations

## 📁 Project Structure

```
bembex_chat_web/
├── app/
│   ├── layout.tsx                 # Root layout with AuthProvider
│   ├── page.tsx                   # Home page (redirects to dashboard/login)
│   ├── login/
│   │   └── page.tsx               # Admin login page
│   └── dashboard/
│       ├── page.tsx               # Dashboard overview
│       └── users/
│           └── page.tsx           # User management page
├── components/
│   ├── LoginForm.tsx              # Login form component
│   ├── Sidebar.tsx                # Dashboard sidebar navigation
│   └── DashboardLayout.tsx        # Main dashboard layout
├── lib/
│   ├── api.ts                     # API utility functions
│   ├── authContext.tsx            # Auth context provider
│   └── useProtectedRoute.ts       # Protected route hook
├── .env.local                     # Environment variables
└── globals.css                    # Global styles
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

The `.env.local` file is already created with the API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

**Important:** This points to your local backend server. Make sure the Express server is running on port 5000.

### 3. Start the Server

Make sure your Express backend server is running:

```bash
# In the server directory
npm run dev
```

### 4. Start the Frontend

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 📖 How It Works

### 1. **Authentication Flow**

1. User navigates to the app
2. If not authenticated → redirected to `/login`
3. Admin enters credentials and logs in
4. Token saved in localStorage and AuthContext
5. Redirected to `/dashboard`
6. Protected routes check for valid token

### 2. **File Organization**

```
lib/
├── api.ts              # Centralized API calls (adminApi, userApi)
├── authContext.tsx     # Global auth state management
└── useProtectedRoute.ts # Custom hook for route protection
```

### 3. **API Integration**

All API calls go through the `api.ts` utility:

```typescript
// Example: Create a user
await adminApi.createUser(token, {
  email: 'user@example.com',
  password: 'pass123',
  username: 'john_doe'
});
```

## 🔐 Pages Overview

### `/` - Home Page
- Redirects to `/dashboard` if logged in
- Redirects to `/login` if not logged in

### `/login` - Admin Login
- Email: `admin@example.com`
- Password: `admin123`
- Creates session and stores token

### `/dashboard` - Dashboard Overview
- Shows total users count
- Shows active users count
- Quick navigation to user management

### `/dashboard/users` - User Management
- **View:** Display all users in a table
- **Create:** Add new users (email, username, password)
- **Edit:** Update user details
- **Delete:** Remove users from system

## 🎨 UI Components

### LoginForm
```tsx
- Email/password input fields
- Error message display
- Loading state during login
- Secure login without pre-filled values
```

### DashboardLayout
```tsx
- Sidebar with navigation
- Protected route wrapper
- Loading state animation
- Main content area
```

### Sidebar
```tsx
- Navigation links
- Current user info
- Logout button
- Active page highlighting
```

## 🔑 Key Features Explained

### 1. Authentication Context (`authContext.tsx`)
```typescript
- Manages admin state globally
- Handles login/logout
- Persists token in localStorage
- Provides useAuth() hook
```

### 2. Protected Routes (`useProtectedRoute.ts`)
```typescript
- Checks if user is authenticated
- Redirects to login if needed
- Shows loading state
```

### 3. API Layer (`api.ts`)
```typescript
- Centralized API calls
- Automatic token injection
- Consistent error handling
- Type-safe responses
```

## 📋 Available API Methods

### Admin Operations
```typescript
adminApi.login(email, password)           // Login
adminApi.logout(token)                    // Logout
adminApi.getUsers(token)                  // Get all users
adminApi.getUserById(token, userId)       // Get specific user
adminApi.createUser(token, data)          // Create user
adminApi.updateUser(token, userId, data)  // Update user
adminApi.deleteUser(token, userId)        // Delete user
adminApi.updateUserPassword(token, userId, password) // Reset password
```

## 🧪 Testing

### Admin Login
1. Go to `http://localhost:3000/login`
2. Enter the admin credentials (configured in server `.env`)
3. Click "Sign In"

### User Management
1. Go to `/dashboard/users`
2. Click "+ Create User"
3. Fill in the form and create a user
4. Manage users from the table (edit/delete)

## 🚨 Troubleshooting

### "Connection Refused" Error
- Ensure Express server is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS is enabled on the server

### "Invalid Token" Error
- Clear browser localStorage
- Log out and log in again
- Check if server JWT_SECRET hasn't changed

### "Redirect Loop"
- Ensure `useProtectedRoute()` is only used on pages, not layouts
- Check AuthProvider is in root layout

## 🔧 Customization

### Change API URL
```env
# .env.local
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### Change Default Credentials
Update in login form (`components/LoginForm.tsx`):
```tsx
const [email, setEmail] = useState('your-email@example.com');
const [password, setPassword] = useState('your-password');
```

### Styling
- Uses Tailwind CSS
- See `app/globals.css` for global styles
- Customize colors in component classes

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.1.6 | React framework |
| React | 19.2.3 | UI library |
| Tailwind CSS | 4 | Styling |
| TypeScript | 5 | Type safety |

## 🚀 Production Deployment

### 1. Build
```bash
npm run build
```

### 2. Start Production Server
```bash
npm start
```

### 3. Environment Variables
Update `.env.local` with production API URL:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### 4. CORS Setup
Update server CORS to allow frontend domain:
```javascript
// server.js
origin: 'https://yourdomain.com'
```

## 📞 Support

- Check `/server` directory for API documentation
- Review `lib/api.ts` for all available endpoints
- See component files for UI structure

## 📄 License

ISC

---

**Next Step:** Start your development servers:
1. Backend: `cd server && npm run dev`
2. Frontend: `npm run dev`
3. Open `http://localhost:3000` in your browser 🚀
