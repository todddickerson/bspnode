import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC
  
  const info = {
    hasUrl: !!url,
    hasAnonKey: !!anonKey,
    urlFormat: url ? {
      startsWithHttp: url.startsWith('http'),
      startsWithHttps: url.startsWith('https'),
      includesSupabase: url.includes('supabase'),
      length: url.length,
      // Check if it's a valid Supabase URL format
      matchesPattern: /https:\/\/[a-zA-Z0-9]+\.supabase\.co/.test(url),
      // Derive WebSocket URL
      wsUrl: url ? url.replace('https://', 'wss://') + '/realtime/v1' : null
    } : null,
    keyLength: anonKey?.length || 0,
    nodeEnv: process.env.NODE_ENV
  }
  
  return NextResponse.json(info)
}