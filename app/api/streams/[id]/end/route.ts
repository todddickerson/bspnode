import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Check if user owns the stream
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream || stream.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (stream.status !== 'LIVE') {
      return NextResponse.json(
        { message: 'Stream is not live' },
        { status: 400 }
      )
    }

    // Calculate duration if startedAt exists
    const duration = stream.startedAt 
      ? Math.floor((new Date().getTime() - stream.startedAt.getTime()) / 1000)
      : null

    // Update stream status to ENDED and set recording status
    const updatedStream = await prisma.stream.update({
      where: { id: params.id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        duration,
        recordingStatus: 'UPLOADING', // Indicate recording is being processed
      },
    })

    return NextResponse.json(updatedStream)
  } catch (error) {
    console.error('Error ending stream:', error)
    return NextResponse.json(
      { message: 'Failed to end stream' },
      { status: 500 }
    )
  }
}