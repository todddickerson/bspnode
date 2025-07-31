import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/livekit'

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

    // Get stream details
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
      include: {
        hosts: {
          where: { 
            userId: session.user.id,
            leftAt: null,
          },
        },
      },
    })

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    // Check if user is a host or owner
    const isOwner = stream.userId === session.user.id
    const isHost = stream.hosts.length > 0
    
    if (!isOwner && !isHost) {
      return NextResponse.json(
        { message: 'You are not authorized to join this stream' },
        { status: 403 }
      )
    }

    if (!stream.liveKitRoomName) {
      return NextResponse.json(
        { message: 'This stream does not have a LiveKit room' },
        { status: 400 }
      )
    }

    // Validate that the LiveKit room exists, create if it doesn't
    try {
      const { roomService } = await import('@/lib/livekit')
      const rooms = await roomService.listRooms([stream.liveKitRoomName])
      if (rooms.length === 0) {
        console.log(`LiveKit room ${stream.liveKitRoomName} not found, creating it`)
        // Create the room
        await roomService.createRoom({
          name: stream.liveKitRoomName,
          emptyTimeout: 300, // 5 minutes
          maxParticipants: stream.maxHosts || 4,
        })
      }
    } catch (error) {
      console.error('Error validating/creating LiveKit room:', error)
      // Don't fail if room check fails, try to generate token anyway
    }

    // Generate LiveKit token
    const token = await generateToken({
      roomName: stream.liveKitRoomName,
      participantName: session.user.name || 'Host',
      participantId: session.user.id,
      canPublish: true,
      canSubscribe: true,
    })

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

    return NextResponse.json({ token, url })
  } catch (error) {
    console.error('Error generating token:', error)
    return NextResponse.json(
      { message: 'Failed to generate token' },
      { status: 500 }
    )
  }
}