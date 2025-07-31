import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLiveStream } from '@/lib/mux'
import { createRoom, generateToken } from '@/lib/livekit'

export async function GET() {
  try {
    const streams = await prisma.stream.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(streams)
  } catch (error) {
    console.error('Error fetching streams:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { title, description, streamType = 'RTMP', maxHosts = 4 } = await req.json()

    let streamData: any = {
      title,
      description,
      userId: session.user.id,
      streamType,
    }

    // Handle different stream types
    if (streamType === 'RTMP') {
      // Create Mux live stream for RTMP
      const { streamKey, playbackId, liveStreamId } = await createLiveStream(session.user.id)
      streamData = {
        ...streamData,
        muxStreamKey: streamKey,
        muxPlaybackId: playbackId,
        muxAssetId: liveStreamId,
      }
    } else if (streamType === 'LIVEKIT') {
      // Create LiveKit room for collaborative streaming
      const roomName = `stream-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      try {
        const room = await createRoom(roomName, maxHosts)
        streamData = {
          ...streamData,
          liveKitRoomName: roomName,
          liveKitRoomId: room.sid,
          maxHosts,
        }
      } catch (error) {
        console.error('Failed to create LiveKit room:', error)
        // If LiveKit is not configured, create without room
        streamData = {
          ...streamData,
          liveKitRoomName: roomName,
          maxHosts,
        }
      }
    } else if (streamType === 'BROWSER') {
      // For browser streams, we don't create the Mux stream until broadcast starts
      // This is handled by the streaming service when initializing the session
      streamData = {
        ...streamData,
        maxHosts: 1,
      }
    }

    // Create stream in database
    const stream = await prisma.stream.create({
      data: streamData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // For LiveKit and Browser streams, create the owner as the first host
    if (streamType === 'LIVEKIT' || streamType === 'BROWSER') {
      await prisma.streamHost.create({
        data: {
          streamId: stream.id,
          userId: session.user.id,
          role: 'OWNER',
        },
      })
    }

    return NextResponse.json(stream)
  } catch (error) {
    console.error('Error creating stream:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}