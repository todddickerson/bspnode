import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC

console.log('🔧 Supabase client initialization:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
})

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('❌ Supabase environment variables not found. Real-time features will be disabled.')
  console.warn('Missing:', {
    NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !supabaseAnonKey
  })
}

// Create a single supabase client for interacting with your database
// Return a dummy client if env vars are missing
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'bspnode-realtime'
        }
      }
    })
  : null as any

if (supabase) {
  console.log('✅ Supabase client created successfully')
} else {
  console.log('❌ Supabase client not created - missing environment variables')
}

// Create a service role client for server-side operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_SECRET
export const supabaseAdmin = typeof window === 'undefined' && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null