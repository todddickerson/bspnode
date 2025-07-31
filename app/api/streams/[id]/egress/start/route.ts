import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { streamingService } from '@/lib/streaming-service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Start egress to push stream to Mux
    const result = await streamingService.startBroadcastEgress(params.id, {
      waitForViewers: false,
      layout: 'speaker',
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error starting egress:', error)
    
    // Handle specific streaming errors
    if (error.code) {
      let statusCode = 500
      if (error.code === streamingService.ErrorCodes.UNAUTHORIZED) {
        statusCode = 401
      } else if (error.code === streamingService.ErrorCodes.STREAM_NOT_FOUND) {
        statusCode = 404
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
      { message: 'Failed to start egress' },
      { status: 500 }
    )
  }
}