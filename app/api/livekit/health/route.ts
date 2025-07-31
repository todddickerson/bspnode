import { NextResponse } from 'next/server'
import { roomService } from '@/lib/livekit'

export async function GET() {
  try {
    // Test environment variables
    const requiredEnvVars = {
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
      NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    }
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key)
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        status: 'unhealthy',
        error: `Missing environment variables: ${missingVars.join(', ')}`,
        details: requiredEnvVars
      }, { status: 500 })
    }
    
    // Test LiveKit API connectivity
    try {
      await roomService.listRooms()
    } catch (apiError: any) {
      // If it's a 401, the credentials are likely invalid
      if (apiError?.response?.status === 401 || apiError?.message?.includes('401')) {
        return NextResponse.json({
          status: 'unhealthy',
          error: 'Invalid LiveKit credentials',
          details: {
            message: 'The LiveKit API key or secret appears to be invalid',
            url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
          }
        }, { status: 500 })
      }
      throw apiError
    }
    
    return NextResponse.json({
      status: 'healthy',
      message: 'LiveKit service is operational',
      config: {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        hasApiKey: !!process.env.LIVEKIT_API_KEY,
        hasApiSecret: !!process.env.LIVEKIT_API_SECRET,
      }
    })
  } catch (error) {
    console.error('LiveKit health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        hasApiKey: !!process.env.LIVEKIT_API_KEY,
        hasApiSecret: !!process.env.LIVEKIT_API_SECRET,
      }
    }, { status: 500 })
  }
}