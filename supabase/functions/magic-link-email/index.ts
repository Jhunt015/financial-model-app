import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, redirect_url } = await req.json()
    
    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Email and token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct the magic link
    const magicLink = `${redirect_url || 'http://localhost:5173/auth/callback'}?token=${token}`

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sign in to EBIT Financial Model App</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { width: 60px; height: 60px; margin-bottom: 20px; }
            .button { display: inline-block; padding: 14px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sign in to EBIT</h1>
            </div>
            <p>Hi there,</p>
            <p>Click the button below to sign in to your EBIT Financial Model App account:</p>
            <div style="text-align: center;">
              <a href="${magicLink}" class="button">Sign In</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #10b981;">${magicLink}</p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <div class="footer">
              <p>If you didn't request this email, you can safely ignore it.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'EBIT App <noreply@yourdomain.com>', // Replace with your verified domain
        to: [email],
        subject: 'Sign in to EBIT Financial Model App',
        html: emailHtml,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Resend error:', error)
      throw new Error(`Failed to send email: ${error}`)
    }

    const data = await res.json()
    
    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}