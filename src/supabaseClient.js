import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'taskman-pmo@1.0.0',
    },
  },
})

// Connection status monitoring
let isOnline = navigator.onLine
let connectionStatus = 'connecting'

// Monitor online/offline status
window.addEventListener('online', () => {
  isOnline = true
  connectionStatus = 'connected'
  console.log('Internet connection restored')
})

window.addEventListener('offline', () => {
  isOnline = false
  connectionStatus = 'offline'
  console.log('Internet connection lost')
})

// Enhanced error handling for Supabase operations
export const handleSupabaseError = (error, operation = 'operation') => {
  if (!isOnline) {
    console.warn(`Cannot perform ${operation}: No internet connection`)
    return {
      success: false,
      error: 'No internet connection. Please check your network and try again.',
      isOffline: true
    }
  }

  if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_INTERNET_DISCONNECTED')) {
    console.warn(`Network error during ${operation}:`, error)
    return {
      success: false,
      error: 'Network connection error. Please check your internet connection.',
      isNetworkError: true
    }
  }

  console.error(`Error during ${operation}:`, error)
  return {
    success: false,
    error: error?.message || `Failed to ${operation}`,
    originalError: error
  }
}

// Utility function to check connection status
export const getConnectionStatus = () => ({
  isOnline,
  status: connectionStatus
})

// Retry utility for failed operations
export const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!isOnline && attempt === 1) {
        throw new Error('No internet connection')
      }

      const result = await operation()
      return { success: true, data: result }
    } catch (error) {
      const errorResult = handleSupabaseError(error, `retry attempt ${attempt}`)

      if (attempt === maxRetries || errorResult.isOffline) {
        return errorResult
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
    }
  }
}