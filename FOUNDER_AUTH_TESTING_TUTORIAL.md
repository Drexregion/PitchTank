# 🧪 Founder Authentication System - Testing Tutorial

## 📋 **Prerequisites**

Before testing, ensure you have:
- ✅ Database schema updated (Phase 1 SQL executed)
- ✅ Supabase Edge Functions deployed (`sendFounderInvitations`)
- ✅ Environment variables configured
- ✅ Development server running (`npm run dev`)

## 🎯 **Testing Scenarios**

### **Scenario 1: Admin Invitation Management**

#### **Step 1: Access Admin Panel**
1. Navigate to `/admin` in your browser
2. Log in as an admin user
3. Verify you see the new "Founder Invitations" tab

#### **Step 2: Send Founder Invitations**
1. Click on "Founder Invitations" tab
2. Select an event from the dropdown
3. Enter test email addresses (comma-separated):
   ```
   founder1@test.com, founder2@test.com, founder3@test.com
   ```
4. Click "Send Invitations"
5. Verify success message appears

#### **Step 3: Verify Invitation Status**
1. Check your Supabase dashboard
2. Navigate to `founder_invitations` table
3. Verify invitations were created with:
   - Status: `sent`
   - Valid `invitation_token`
   - Correct `event_id`
   - Future `expires_at` date

---

### **Scenario 2: Founder Account Creation**

#### **Step 1: Access Invitation Link**
1. Copy an `invitation_token` from the database
2. Navigate to: `/founder-signup/[TOKEN]`
   ```
   Example: /founder-signup/abc123def456
   ```

#### **Step 2: Complete Signup Form**
1. Verify email is pre-filled and disabled
2. Enter founder details:
   - First Name: `John`
   - Last Name: `Doe`
   - Password: `password123`
   - Confirm Password: `password123`
3. Click "Create Founder Account"

#### **Step 3: Verify Account Creation**
1. Check Supabase `auth.users` table for new user
2. Check `founder_users` table for founder record
3. Verify `founder_invitations` status changed to `used`
4. Verify redirect to `/founder-dashboard`

---

### **Scenario 3: Founder Dashboard**

#### **Step 1: Access Founder Dashboard**
1. Log in as a founder user
2. Navigate to `/founder-dashboard`
3. Verify you see:
   - Welcome message with founder's name
   - Two tabs: "Profile Settings" and "My Projects"

#### **Step 2: Test Profile Management**
1. Click "Profile Settings" tab
2. Update profile information:
   - First Name: `Jane`
   - Last Name: `Smith`
   - Bio: `Experienced entrepreneur with 10+ years in tech`
   - Profile Picture URL: `https://example.com/photo.jpg`
3. Click "Update Profile"
4. Verify success message and data persistence

#### **Step 3: Test Project Creation**
1. Click "My Projects" tab
2. Verify "Create Project" tab is active
3. Fill out project form:
   - Event: Select an active event
   - Project Name: `My Awesome Startup`
   - Description: `Revolutionary AI-powered solution`
   - Logo URL: `https://example.com/logo.png`
   - Pitch Summary: `We're building the future of AI`
   - Pitch URL: `https://youtube.com/watch?v=example`
4. Click "Create Project"
5. Verify project appears in "Manage Projects" tab

#### **Step 4: Test Project Management**
1. Switch to "Manage Projects" tab
2. Verify created project is listed
3. Click "Edit" on the project
4. Update project details
5. Click "Save Changes"
6. Verify updates are reflected

---

### **Scenario 4: Authentication Flow**

#### **Step 1: Test Founder Login**
1. Navigate to `/founder-login`
2. Enter founder credentials
3. Click "Sign In"
4. Verify redirect to `/founder-dashboard`

#### **Step 2: Test Regular User Login**
1. Navigate to `/login`
2. Enter regular user credentials
3. Click "Sign In"
4. Verify redirect to appropriate dashboard

#### **Step 3: Test Navigation**
1. As a founder, verify navbar shows:
   - "Founder Dashboard" link
   - Founder's full name in user menu
2. As a regular user, verify navbar shows:
   - "Dashboard" link
   - Email address in user menu

---

### **Scenario 5: Real-time Updates**

#### **Step 1: Test Live Data Updates**
1. Open founder dashboard in two browser tabs
2. Update profile in one tab
3. Verify changes appear in the other tab automatically
4. Create a new project in one tab
5. Verify project appears in the other tab

#### **Step 2: Test Cross-User Updates**
1. Open admin panel and founder dashboard
2. Send new invitations from admin panel
3. Verify founder dashboard updates (if applicable)

---

## 🔍 **Debugging Tools**

### **FounderAuthTest Component**
Add this component to any page for debugging:

```tsx
import { FounderAuthTest } from '../components/FounderAuthTest';

// Add to any page component
<FounderAuthTest />
```

This will show:
- Current user authentication state
- Founder status
- Founder user data
- Project count
- Loading states

### **Browser Console Checks**
1. Open browser DevTools (F12)
2. Check Console for any errors
3. Verify Supabase connection logs
4. Check Network tab for API calls

### **Database Verification**
Check these tables in Supabase:
- `founder_invitations` - Invitation status
- `founder_users` - Founder account data
- `founders` - Project data
- `auth.users` - Authentication data

---

## 🚨 **Common Issues & Solutions**

### **Issue: Invitation Link Not Working**
**Symptoms:** 404 error or "Invalid Invitation" message
**Solutions:**
1. Check token exists in `founder_invitations` table
2. Verify token hasn't expired
3. Ensure URL format is correct: `/founder-signup/[TOKEN]`

### **Issue: Founder Account Creation Fails**
**Symptoms:** Error during signup process
**Solutions:**
1. Check Supabase RLS policies
2. Verify email matches invitation
3. Check browser console for detailed errors

### **Issue: Real-time Updates Not Working**
**Symptoms:** Changes don't appear automatically
**Solutions:**
1. Check Supabase realtime is enabled
2. Verify subscription channels are active
3. Check network connectivity

### **Issue: Navigation Not Updating**
**Symptoms:** Wrong dashboard links or user info
**Solutions:**
1. Refresh page to reload auth state
2. Check `useAuth` hook is working correctly
3. Verify founder user data is loaded

---

## ✅ **Testing Checklist**

- [ ] Admin can send invitations
- [ ] Invitation emails are created in database
- [ ] Founder can access signup page with valid token
- [ ] Founder can create account successfully
- [ ] Founder dashboard loads correctly
- [ ] Profile management works
- [ ] Project creation works
- [ ] Project editing works
- [ ] Founder login works
- [ ] Navigation shows correct links
- [ ] Real-time updates work
- [ ] Error handling works properly
- [ ] Mobile responsiveness works
- [ ] Cross-browser compatibility

---

## 🎉 **Success Criteria**

The founder authentication system is working correctly when:

1. **Admins** can easily send invitations to founders
2. **Founders** can create accounts via invitation links
3. **Founders** can manage their profiles and projects
4. **Real-time updates** work seamlessly
5. **Navigation** adapts based on user type
6. **Error handling** provides clear feedback
7. **Existing functionality** remains unchanged

---

## 📞 **Support**

If you encounter issues:
1. Check the browser console for errors
2. Verify database data is correct
3. Test with the `FounderAuthTest` component
4. Review the integration documentation
5. Check Supabase logs for backend issues

**Happy Testing! 🚀**
