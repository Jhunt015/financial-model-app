import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jpcupuyynyclyaixztad.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwY3VwdXl5bnljbHlhaXh6dGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NjAyOTgsImV4cCI6MjA2NzIzNjI5OH0.aNVz2czRy5NmYRHdBF-1FE5ZUtBzej5iOTqnKUUKJcE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugAuth() {
  console.log('🔍 Debugging Supabase Authentication...\n')
  
  // Test 1: Check if Supabase is reachable
  console.log('1️⃣ Testing Supabase connection...')
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.log('❌ Connection error:', error)
    } else {
      console.log('✅ Connected to Supabase')
    }
  } catch (err) {
    console.log('❌ Cannot connect:', err.message)
  }
  
  // Test 2: Try different auth methods
  console.log('\n2️⃣ Testing magic link with different options...')
  
  // Try without redirect URL
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: 'jhunt015@gmail.com'
    })
    
    if (error) {
      console.log('❌ Basic magic link error:', error.message)
      console.log('   Error code:', error.code)
      console.log('   Status:', error.status)
    } else {
      console.log('✅ Basic magic link sent!')
    }
  } catch (err) {
    console.log('❌ Unexpected error:', err)
  }
  
  // Test 3: Check auth settings
  console.log('\n3️⃣ Checking project configuration...')
  console.log('Project URL:', supabaseUrl)
  console.log('Using anon key:', supabaseAnonKey.substring(0, 20) + '...')
  
  console.log('\n📋 Recommendations:')
  console.log('1. In Supabase dashboard, go to Authentication → Providers')
  console.log('2. Click on Email provider settings')
  console.log('3. Make sure "Enable Email Provider" is ON')
  console.log('4. Check if there\'s a "Confirm email" or similar option to disable')
  console.log('5. Also check Authentication → Email Templates')
}

debugAuth()