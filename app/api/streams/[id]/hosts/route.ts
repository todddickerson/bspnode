import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
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

    // Get hosts for the stream
    const hosts = await prisma.streamHost.findMany({
      where: { 
        streamId: params.id,
        leftAt: null, // Only active hosts
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    })

    return NextResponse.json(hosts)
  } catch (error) {
    console.error('Error fetching hosts:', error)
    return NextResponse.json(
      { message: 'Failed to fetch hosts' },
      { status: 500 }
    )
  }
}

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

    const { userId, role = 'HOST' } = await req.json()

    // Get the stream
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    // Check permissions:
    // 1. Stream owner can add anyone
    // 2. Users can add themselves (for join links)
    const isStreamOwner = stream.userId === session.user.id
    const isAddingSelf = userId === session.user.id

    if (!isStreamOwner && !isAddingSelf) {
      return NextResponse.json(
        { message: 'You can only add yourself as a host' },
        { status: 403 }
      )
    }

    // Check if stream is LiveKit type
    if (stream.streamType !== 'LIVEKIT') {
      return NextResponse.json(
        { message: 'This stream does not support multiple hosts' },
        { status: 400 }
      )
    }

    // Check max hosts limit
    const currentHostsCount = await prisma.streamHost.count({
      where: { 
        streamId: params.id,
        leftAt: null,
      },
    })

    if (currentHostsCount >= (stream.maxHosts || 4)) {
      return NextResponse.json(
        { message: 'Maximum number of hosts reached' },
        { status: 400 }
      )
    }

    // Check if user is already a host
    const existingHost = await prisma.streamHost.findFirst({
      where: {
        streamId: params.id,
        userId,
        leftAt: null,
      },
    })

    if (existingHost) {
      return NextResponse.json(
        { message: 'User is already a host' },
        { status: 400 }
      )
    }

    // Add host
    const host = await prisma.streamHost.create({
      data: {
        streamId: params.id,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(host)
  } catch (error) {
    console.error('Error adding host:', error)
    return NextResponse.json(
      { message: 'Failed to add host' },
      { status: 500 }
    )
  }
}