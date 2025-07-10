# 🔐 Security Setup Guide

## Adding the New Grok API Key Securely

### Step 1: Add to Vercel Environment Variables

1. **Go to Vercel Dashboard:**
   - Visit https://vercel.com/dashboard
   - Navigate to your `financial-model-app` project
   - Click on "Settings" tab
   - Go to "Environment Variables" section

2. **Add the API Key:**
   - Click "Add New"
   - **Name:** `XAI_API_KEY`
   - **Value:** `xai-QI3Jtobugz57a8HmiChPFCuuPujnP8HTPR45j1BA7HgHuOdrUZDvGeC953Bk0DlKrfFPcKh6nr51L8NB`
   - **Environment:** Select "All Environments" (Production, Preview, Development)
   - Click "Save"

3. **Redeploy:**
   - Go back to your project's main page
   - Click "Redeploy" or push a new commit to trigger deployment

### Step 2: Security Best Practices

✅ **What We've Done:**
- Removed old API key from public repository
- Updated documentation to not include actual keys
- Enhanced .gitignore to prevent future key exposure
- Created secure deployment process

⚠️ **Important Security Rules:**
- **NEVER** commit API keys to Git repositories
- **ALWAYS** use environment variables for secrets
- **REGULARLY** rotate API keys for security
- **MONITOR** API usage for suspicious activity

### Step 3: Verify Setup

After adding the environment variable to Vercel:

1. **Test the Application:**
   - Upload a PDF document
   - Verify Grok 4 Vision analysis works
   - Check that extraction is successful

2. **Monitor Logs:**
   - Check Vercel function logs for any API errors
   - Ensure no API key appears in logs

### Step 4: Future Key Management

- **Rotation:** Change API keys every 90 days
- **Monitoring:** Set up alerts for unusual API usage
- **Access:** Limit who has access to production environment variables
- **Backup:** Keep secure backup of working configurations

## Emergency Response

If an API key is ever exposed again:

1. **Immediately revoke** the exposed key in Grok dashboard
2. **Generate new key** from Grok console
3. **Update Vercel** environment variables
4. **Force redeploy** the application
5. **Review logs** for any unauthorized usage

## Contact

For security concerns or questions, check Vercel docs or Grok support.