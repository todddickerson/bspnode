import { NextRequest, NextResponse } from 'next/server'
import { streamingService } from '@/lib/streaming-service'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const health = await streamingService.getStreamHealth(params.id)
    
    return NextResponse.json(health)
  } catch (error: any) {
    console.error('Error getting stream health:', error)
    
    if (error.code === streamingService.ErrorCodes.STREAM_NOT_FOUND) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { message: 'Failed to get stream health' },
      { status: 500 }
    )
  }
}