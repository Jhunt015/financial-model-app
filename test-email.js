import { createClient } from '@supabase/supabase-js'

// Your Supabase credentials
const supabaseUrl = 'https://jpcupuyynyclyaixztad.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwY3VwdXl5bnljbHlhaXh6dGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NjAyOTgsImV4cCI6MjA2NzIzNjI5OH0.aNVz2czRy5NmYRHdBF-1FE5ZUtBzej5iOTqnKUUKJcE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testEmail() {
  // Replace with your email
  const testEmail = 'jhunt015@gmail.com'
  
  console.log('🚀 Testing Supabase email...')
  console.log(`📧 Sending magic link to: ${testEmail}`)
  
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:5173/auth/callback',
      }
    })
    
    if (error) {
      console.error('❌ Error:', error.message)
      console.log('\n🔧 Possible fixes:')
      
      if (error.message.includes('rate')) {
        console.log('- You\'ve hit the rate limit. Wait 1 hour or use a different email')
      }
      if (error.message.includes('confirmation')) {
        console.log('- Disable email confirmations in Supabase dashboard')
        console.log('- Go to: Authentication → Settings → Uncheck "Enable email confirmations"')
      }
      if (error.message.includes('not authorized')) {
        console.log('- Check your Supabase credentials are correct')
      }
    } else {
      console.log('✅ Success! Magic link email sent.')
      console.log('📬 Check your email inbox (and spam folder)')
      console.log('\n📋 Response:', data)
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

// Run the test
testEmail()