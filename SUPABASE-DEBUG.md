# Debug Supabase "Error Sending Confirmation Email"

## 🔍 Root Cause
The error "error sending confirmation email" typically means:
1. Email confirmations are enabled but not properly configured
2. OR there's a rate limit issue
3. OR the Site URL/Redirect URLs are incorrect

## 🛠️ Fix in Supabase Dashboard

### Step 1: Disable Email Confirmations (Recommended for Development)
1. Go to: https://supabase.com/dashboard/project/jpcupuyynyclyaixztad
2. **Authentication** → **Settings**
3. Find **"Enable email confirmations"**
4. **TURN IT OFF** (uncheck the box)
5. Save changes

### Step 2: Configure URLs
1. Still in **Authentication** → **Settings**
2. Set **Site URL**: `http://localhost:5173`
3. In **Redirect URLs**, add: `http://localhost:5173/auth/callback`

### Step 3: Alternative - Use Password Auth for Development
If magic links keep failing, temporarily enable password auth:
1. **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. **Disable** "Confirm email" option

## 🔄 Quick Test
After making these changes:
1. Restart your app: `npm run dev`
2. Try logging in again
3. Should work without email confirmation errors

## 🚀 Alternative: Pure Mock Auth
If you want to skip Supabase entirely for now, I can switch your app back to pure mock authentication until you're ready for production.

Let me know which approach you prefer!