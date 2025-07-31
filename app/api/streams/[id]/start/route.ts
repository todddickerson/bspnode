import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamingService } from '@/lib/streaming-service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !session?.user?.name) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize streaming session using the service
    // This will validate ownership, create LiveKit room, create Mux stream, etc.
    const streamingSession = await streamingService.initializeStreamingSession(
      params.id,
      session.user.id,
      session.user.name
    )

    return NextResponse.json({
      success: true,
      ...streamingSession,
    })
  } catch (error: any) {
    console.error('Error starting stream:', error)
    
    // Handle specific streaming errors
    if (error.code) {
      let statusCode = 500
      if (error.code === streamingService.ErrorCodes.UNAUTHORIZED) {
        statusCode = 401
      } else if (error.code === streamingService.ErrorCodes.STREAM_NOT_FOUND) {
        statusCode = 404
      } else if (error.code === streamingService.ErrorCodes.ALREADY_BROADCASTING) {
        statusCode = 400
      }
      
      return NextResponse.json(
        { 
          message: error.message,
          code: error.code,
          recoverable: error.recoverable || false,
        },
        { status: statusCode }
      )
    }
    
    return NextResponse.json(
      { message: 'Failed to start stream' },
      { status: 500 }
    )
  }
}