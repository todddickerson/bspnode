import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/livekit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get stream details
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    if (!stream.liveKitRoomName) {
      return NextResponse.json(
        { message: 'This stream does not have a LiveKit room' },
        { status: 400 }
      )
    }

    // Generate LiveKit token for viewer (no publishing permissions)
    const token = await generateToken({
      roomName: stream.liveKitRoomName,
      participantName: `Viewer-${Date.now()}`, 
      participantId: `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      canPublish: false, // Viewers can't publish
      canSubscribe: true, // But they can subscribe to see the stream
    })

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

    return NextResponse.json({ token, url })
  } catch (error) {
    console.error('Error generating viewer token:', error)
    return NextResponse.json(
      { message: 'Failed to generate viewer token' },
      { status: 500 }
    )
  }
}