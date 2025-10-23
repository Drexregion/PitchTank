# 🔐 Admin Access Setup Guide

## **Quick Fix Applied**

I've updated the admin detection logic in `src/hooks/useAuth.ts` to use email-based admin detection. The system now recognizes these emails as admin users:

- `admin@pitchtank.com`
- `daeso@example.com` 
- `admin@example.com`
- `test@admin.com`

## **How to Login as Admin**

### **Option 1: Use Existing Admin Email**
If you already have an account with one of the admin emails above:
1. Go to `/login`
2. Enter your admin email and password
3. Navigate to `/admin` - you should now have access

### **Option 2: Create New Admin Account**
If you don't have an admin account yet:

1. **Sign up with admin email:**
   - Go to `/signup`
   - Use one of the admin emails (e.g., `admin@pitchtank.com`)
   - Complete the signup process

2. **Access admin panel:**
   - Go to `/admin`
   - You should now see the admin dashboard

### **Option 3: Add Your Email to Admin List**
To add your own email as admin:

1. **Edit the admin emails list** in `src/hooks/useAuth.ts`:
   ```typescript
   const adminEmails = [
     'admin@pitchtank.com',
     'daeso@example.com',
     'admin@example.com',
     'test@admin.com',
     'your-email@example.com'  // Add your email here
   ];
   ```

2. **Restart your development server:**
   ```bash
   npm run dev
   ```

3. **Login with your email** and access `/admin`

## **Testing Admin Access**

### **Step 1: Verify Admin Status**
Add this to any page temporarily to check your admin status:
```tsx
import { useAuth } from '../hooks/useAuth';

// In your component:
const { user, isAdmin } = useAuth();
console.log('User:', user?.email);
console.log('Is Admin:', isAdmin);
```

### **Step 2: Test Admin Features**
Once logged in as admin, you should see:
- "Admin" link in the navbar
- Admin dashboard at `/admin`
- "Founder Invitations" tab in admin panel
- Ability to create events and send invitations

## **Advanced: Database-Based Admin System**

For a more robust solution, you can implement a database-based admin system:

### **1. Create Admin Users Table**
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **2. Update Admin Detection Logic**
```typescript
// In useAuth.ts, replace the email-based logic with:
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  if (user) {
    const checkAdminStatus = async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(!!data);
    };
    
    checkAdminStatus();
  }
}, [user]);
```

## **Troubleshooting**

### **Issue: Still Redirected to Home**
**Solutions:**
1. Check browser console for errors
2. Verify you're logged in with an admin email
3. Clear browser cache and cookies
4. Restart development server

### **Issue: Admin Email Not Recognized**
**Solutions:**
1. Check email spelling in admin emails list
2. Ensure email is lowercase in the list
3. Verify you're logged in with the correct email
4. Add your email to the admin emails array

### **Issue: Admin Panel Not Loading**
**Solutions:**
1. Check if you're logged in (`user` should not be null)
2. Verify `isAdmin` is true in browser console
3. Check for JavaScript errors in console
4. Ensure all admin components are properly imported

## **Quick Test Commands**

Add this to any page to debug admin status:
```tsx
const { user, isAdmin, isLoading } = useAuth();

if (isLoading) return <div>Loading...</div>;

return (
  <div>
    <p>Email: {user?.email}</p>
    <p>Is Admin: {isAdmin ? 'Yes' : 'No'}</p>
    <p>Can Access Admin: {isAdmin ? '✅' : '❌'}</p>
  </div>
);
```

## **Next Steps**

Once you have admin access:
1. Test the founder invitation system
2. Create test events
3. Send test invitations
4. Verify the complete founder flow works

**You should now be able to access the admin panel! 🎉**
