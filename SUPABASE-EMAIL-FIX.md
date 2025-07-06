# Fixing Supabase Email Issues

## Current Issue
You're getting "Error sending magic link email" (500 error) from Supabase.

## Solution Options:

### Option 1: Fix Built-in Email Service (Easiest)
1. Go to: https://supabase.com/dashboard/project/jpcupuyynyclyaixztad/auth/providers
2. Click on **Email** provider
3. Make sure it's **enabled**
4. Check these settings:
   - Enable Email Provider: ON
   - Confirm email: OFF (unchecked)

### Option 2: Use Custom SMTP (Most Reliable)
1. Go to: https://supabase.com/dashboard/project/jpcupuyynyclyaixztad/settings/auth
2. Scroll to **SMTP Settings**
3. Configure with your email provider:

#### Gmail Example:
- Host: `smtp.gmail.com`
- Port: `587`
- Username: Your Gmail address
- Password: App-specific password (not regular password)
- Sender email: Your Gmail address
- Sender name: `EBIT App`

#### SendGrid Example (Free tier available):
1. Sign up at sendgrid.com
2. Create API key
3. Use these settings:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: Your SendGrid API key

### Option 3: Wait for Rate Limit Reset
If you were getting rate limit errors earlier, wait 1 hour and try again.

## Test After Fixing:
```bash
node test-email.js
```

Or test directly in your app at http://localhost:5173/