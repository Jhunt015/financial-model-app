# Supabase Setup for Magic Link Authentication

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" 
3. Sign up/Login with GitHub
4. Click "New Project"
5. Choose your organization
6. Fill in:
   - **Name**: `financial-model-app` (or whatever you prefer)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is perfect to start
6. Click "Create new project"
7. Wait 2-3 minutes for setup to complete

## Step 2: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **Anon public key** (starts with `eyJ...`)

## Step 3: Configure Authentication

1. In Supabase dashboard, go to **Authentication** > **Settings**
2. Under **Auth Providers**, make sure **Email** is enabled
3. Configure **Email Auth**:
   - Enable "Enable email confirmations" 
   - Set "Site URL" to `http://localhost:5173` (for development)
4. Under **Email Templates**:
   - Customize the "Magic Link" template if desired
   - The default template works fine for testing

## Step 4: Add Supabase to Your Project

Run this in your project directory:

```bash
npm install @supabase/supabase-js
```

## Step 5: Environment Variables

Create a `.env.local` file in your project root:

```bash
# .env.local
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: Add `.env.local` to your `.gitignore` file to keep your keys secure!

## Step 6: Update Your Code

I'll help you integrate Supabase into your existing app in the next step.

## Step 7: Email Configuration (Optional)

For production, you can configure custom email settings:
1. Go to **Settings** > **Auth** > **SMTP Settings**
2. Configure your own email provider (Gmail, SendGrid, etc.)
3. For development, Supabase's built-in email works fine

## Next Steps

Once you have:
1. ✅ Created your Supabase project
2. ✅ Copied your URL and anon key
3. ✅ Installed the Supabase package
4. ✅ Created the `.env.local` file

Let me know and I'll help you integrate it into your React app!