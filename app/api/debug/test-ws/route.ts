import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  
  if (!url) {
    return NextResponse.json({ error: 'No Supabase URL found' })
  }
  
  // Extract project ref from URL
  const match = url.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co/)
  const projectRef = match ? match[1] : null
  
  const wsUrl = url.replace('https://', 'wss://') + '/realtime/v1/websocket'
  
  return NextResponse.json({
    projectRef,
    httpUrl: url,
    wsUrl,
    realtimeEndpoints: {
      websocket: wsUrl,
      // Alternative endpoints
      websocketWithKey: wsUrl + '?apikey=' + (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC || '').substring(0, 10) + '...',
      // Check if using correct protocol
      protocol: url.startsWith('https://') ? 'wss://' : 'ws://',
    },
    headers: {
      // Headers that should be sent with WebSocket connection
      requiredHeaders: [
        'apikey: [SUPABASE_ANON_KEY]',
        'X-Client-Info: supabase-js/2.x.x'
      ]
    }
  })
}