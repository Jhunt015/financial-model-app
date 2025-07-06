# Quick Start Guide

## ✅ What's Already Set Up
- Supabase package installed
- Authentication hooks created
- Environment file created
- Code integrated to use either Supabase or mock auth

## 🚀 To Enable Real Magic Link Emails

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) 
2. Create new project
3. Wait for setup to complete

### Step 2: Get Your Keys
In your Supabase dashboard:
1. Go to **Settings** > **API**
2. Copy your **Project URL** and **anon public key**

### Step 3: Update Environment
Edit `.env.local` and replace the placeholder values:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Configure Auth Settings
In Supabase dashboard:
1. Go to **Authentication** > **Settings**
2. Set **Site URL** to `http://localhost:5173`
3. Make sure **Enable email confirmations** is checked

### Step 5: Restart Your App
```bash
npm run dev
```

## 🎯 Current Behavior

**Without Supabase configured**: Mock authentication (auto-login after email entry)
**With Supabase configured**: Real magic link emails sent to users

## 🔧 Testing Magic Links

1. Enter your email in the login form
2. Check your email for the magic link
3. Click the link to complete authentication
4. You'll be redirected back to the app and logged in

That's it! Your app now has real magic link authentication powered by Supabase.