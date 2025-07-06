import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Global auth state (in a real app, this would be React Context or a state management library)
let globalAuthState = {
  user: null,
  setUser: null,
  listeners: []
}

export function useSupabaseAuth() {
  const [user, setUser] = useState(globalAuthState.user)
  const [isLoading, setIsLoading] = useState(true) // Start with loading=true
  const [authError, setAuthError] = useState('')

  // Register this component's setUser function
  useEffect(() => {
    globalAuthState.listeners.push(setUser)
    
    // Update local state if global state exists
    if (globalAuthState.user) {
      setUser(globalAuthState.user)
    }
    
    return () => {
      globalAuthState.listeners = globalAuthState.listeners.filter(l => l !== setUser)
    }
  }, [])
  
  // Global setUser that updates all listeners
  globalAuthState.setUser = (newUser) => {
    globalAuthState.user = newUser
    globalAuthState.listeners.forEach(listener => listener(newUser))
  }

  // Listen to auth changes and check for existing sessions
  useEffect(() => {
    const checkSession = async () => {
      if (isSupabaseConfigured) {
        // Check for existing Supabase session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const supabaseUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.email?.split('@')[0] || 'User',
            picture: `https://ui-avatars.com/api/?name=${session.user.email?.split('@')[0] || 'User'}&background=10b981&color=fff`,
            analysisCount: 0,
            isPro: false,
            savedModels: []
          }
          globalAuthState.setUser(supabaseUser)
        }
      } else {
        // Check for mock auth session in localStorage
        const savedUser = localStorage.getItem('mock-auth-user')
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser)
            // Ensure savedModels array exists
            if (!user.savedModels) {
              user.savedModels = []
            }
            globalAuthState.setUser(user)
          } catch (e) {
            localStorage.removeItem('mock-auth-user')
          }
        }
      }
      setIsLoading(false)
    }

    checkSession()

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change:', event, session?.user?.email)
          if (session?.user) {
            const supabaseUser = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.email?.split('@')[0] || 'User',
              picture: `https://ui-avatars.com/api/?name=${session.user.email?.split('@')[0] || 'User'}&background=10b981&color=fff`,
              analysisCount: 0,
              isPro: false,
              savedModels: []
            }
            globalAuthState.setUser(supabaseUser)
          } else {
            globalAuthState.setUser(null)
          }
          setIsLoading(false)
        }
      )

      return () => subscription.unsubscribe()
    }
  }, [])

  const sendMagicLink = async (email) => {
    setIsLoading(true)
    setAuthError('')

    try {
      if (isSupabaseConfigured) {
        // Use real Supabase magic link
        const { error } = await supabase.auth.signInWithOtp({ 
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            shouldCreateUser: true
          }
        })

        if (error) {
          // If rate limited, fall back to mock auth for development
          if (error.message.includes('rate') || error.message.includes('limit')) {
            console.log('📧 Rate limited - using mock authentication for development')
            setTimeout(() => {
              const mockUser = {
                id: Math.random().toString(36).substr(2, 9),
                email,
                name: email.split('@')[0],
                picture: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=10b981&color=fff`,
                analysisCount: 0,
                isPro: false,
                savedModels: []
              }
              // Save to localStorage for persistence
              localStorage.setItem('mock-auth-user', JSON.stringify(mockUser))
              globalAuthState.setUser(mockUser)
              setIsLoading(false)
            }, 1500)
            return true
          } else {
            setAuthError(error.message)
            setIsLoading(false)
            return false
          }
        }

        console.log(`📧 Magic link sent to: ${email}`)
        // Don't set loading to false here - let the auth state change handle it
        return true
      } else {
        // Fallback to mock authentication
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        console.log(`📧 Mock magic link sent to: ${email}`)
        console.log(`🔗 Add your Supabase credentials to .env.local for real emails`)
        
        // For demo purposes, auto-login the user
        setTimeout(() => {
          const mockUser = {
            id: Math.random().toString(36).substr(2, 9),
            email,
            name: email.split('@')[0],
            picture: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=10b981&color=fff`,
            analysisCount: 0,
            isPro: false,
            savedModels: []
          }
          // Save to localStorage for persistence
          localStorage.setItem('mock-auth-user', JSON.stringify(mockUser))
          globalAuthState.setUser(mockUser)
          setIsLoading(false)
        }, 2000)
        
        return true
      }
    } catch (error) {
      setAuthError('Failed to send magic link. Please try again.')
      setIsLoading(false)
      return false
    }
  }

  const saveModel = (model) => {
    if (user) {
      // Ensure savedModels exists
      const currentModels = user.savedModels || [];
      const updatedUser = {
        ...user,
        savedModels: [...currentModels, model]
      }
      
      // Update localStorage if using mock auth
      if (!isSupabaseConfigured) {
        localStorage.setItem('mock-auth-user', JSON.stringify(updatedUser))
      }
      
      globalAuthState.setUser(updatedUser)
      console.log('Model saved:', model.name)
    }
  }

  const updateModel = (modelId, updates) => {
    if (user) {
      const updatedUser = {
        ...user,
        savedModels: user.savedModels.map(model =>
          model.id === modelId ? { ...model, ...updates } : model
        )
      }
      
      // Update localStorage if using mock auth
      if (!isSupabaseConfigured) {
        localStorage.setItem('mock-auth-user', JSON.stringify(updatedUser))
      }
      
      globalAuthState.setUser(updatedUser)
    }
  }

  const deleteModel = (modelId) => {
    if (user) {
      const updatedUser = {
        ...user,
        savedModels: user.savedModels.filter(model => model.id !== modelId)
      }
      
      // Update localStorage if using mock auth
      if (!isSupabaseConfigured) {
        localStorage.setItem('mock-auth-user', JSON.stringify(updatedUser))
      }
      
      globalAuthState.setUser(updatedUser)
    }
  }

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem('mock-auth-user')
      globalAuthState.setUser(null)
    }
    setAuthError('')
  }

  return { 
    user, 
    sendMagicLink,
    signOut, 
    isLoading, 
    saveModel,
    updateModel,
    deleteModel,
    authError,
    isSupabaseConfigured
  }
}