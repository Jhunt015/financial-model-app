import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the URL hash/search params
        const urlParams = new URLSearchParams(window.location.search)
        const urlHash = window.location.hash

        // Handle the auth callback - this processes the magic link
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          // Redirect to home with error
          window.location.href = '/?auth=error'
          return
        }

        if (data.session) {
          console.log('Successfully authenticated via magic link!')
          console.log('User email:', data.session.user.email)
          
          // Check if user was trying to build a model (check localStorage or URL state)
          const redirectPath = localStorage.getItem('auth-redirect') || '/'
          localStorage.removeItem('auth-redirect')
          
          // Small delay to ensure auth state is updated
          setTimeout(() => {
            window.location.href = redirectPath
          }, 500)
        } else {
          // Try to get session from URL if direct session check failed
          console.log('No direct session, checking URL params...')
          const { data: authData, error: authError } = await supabase.auth.getUser()
          
          if (authData.user) {
            console.log('Found user from URL params:', authData.user.email)
            
            const redirectPath = localStorage.getItem('auth-redirect') || '/'
            localStorage.removeItem('auth-redirect')
            
            setTimeout(() => {
              window.location.href = redirectPath
            }, 500)
          } else {
            console.log('No session found, redirecting to home')
            window.location.href = '/'
          }
        }
      } catch (error) {
        console.error('Unexpected auth error:', error)
        window.location.href = '/?auth=error'
      }
    }

    handleAuthCallback()
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-black mb-2">Completing Sign In...</h2>
        <p className="text-gray-600">Please wait while we log you in.</p>
      </div>
    </div>
  )
}