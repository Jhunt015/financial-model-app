# Magic Link Email Setup Guide

## Current State
The app currently simulates magic link functionality for demo purposes. Users are automatically logged in after entering their email.

## To Implement Real Magic Links

### 1. Backend API Needed
You'll need a backend service to handle:
- Email sending
- Token generation and validation
- User authentication

### 2. Example Backend Endpoint
```javascript
// POST /api/auth/magic-link
app.post('/api/auth/magic-link', async (req, res) => {
  const { email } = req.body;
  
  // Generate secure token
  const token = generateSecureToken();
  
  // Store token in database with expiration
  await storeToken(email, token, expiresIn: '15m');
  
  // Send email with magic link
  await sendEmail({
    to: email,
    subject: 'Sign in to EBIT Financial App',
    html: `<a href="https://yourdomain.com/auth/verify?token=${token}">Click to sign in</a>`
  });
  
  res.json({ success: true });
});
```

### 3. Email Services
Popular options:
- **SendGrid** - Easy to integrate
- **Mailgun** - Good deliverability
- **AWS SES** - Cost-effective
- **Postmark** - Great for transactional emails

### 4. Frontend Integration
Replace the mock `sendMagicLink` function with:
```javascript
const sendMagicLink = async (email) => {
  const response = await fetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.ok;
};
```

### 5. Token Verification
Handle the magic link click:
```javascript
// GET /auth/verify?token=xxx
app.get('/auth/verify', async (req, res) => {
  const { token } = req.query;
  
  // Verify token and get user
  const user = await verifyToken(token);
  
  if (user) {
    // Generate session/JWT
    const sessionToken = generateSessionToken(user);
    // Redirect with auth token
    res.redirect(`/dashboard?auth=${sessionToken}`);
  } else {
    res.redirect('/login?error=invalid_token');
  }
});
```

## Quick Setup with Supabase
For a quick implementation, consider Supabase which has built-in magic link auth:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Send magic link
await supabase.auth.signInWithOtp({ email })

// Handle auth state
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // User is logged in
    setUser(session.user)
  }
})
```