import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { token, streamId } = await req.json()

    if (!token || !streamId) {
      return NextResponse.json(
        { message: 'Token and streamId are required' },
        { status: 400 }
      )
    }

    // Find the invite
    const invite = await prisma.hostInvite.findUnique({
      where: { token },
      include: {
        stream: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { message: 'Invalid invite token' },
        { status: 404 }
      )
    }

    // Check if invite belongs to the correct stream
    if (invite.streamId !== streamId) {
      return NextResponse.json(
        { message: 'Invalid invite token for this stream' },
        { status: 400 }
      )
    }

    // Check if invite is active
    if (!invite.isActive) {
      return NextResponse.json(
        { message: 'This invite has been revoked' },
        { status: 400 }
      )
    }

    // Check if invite has expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json(
        { message: 'This invite has expired' },
        { status: 400 }
      )
    }

    // Check if invite has been used up
    if (invite.usedCount >= invite.maxUses) {
      return NextResponse.json(
        { message: 'This invite has reached its usage limit' },
        { status: 400 }
      )
    }

    // Check if stream supports multiple hosts
    if (invite.stream.streamType !== 'LIVEKIT') {
      return NextResponse.json(
        { message: 'This stream does not support multiple hosts' },
        { status: 400 }
      )
    }

    // Check if user is already a host
    const existingHost = await prisma.streamHost.findFirst({
      where: {
        streamId: streamId,
        userId: session.user.id,
        leftAt: null,
      },
    })

    if (existingHost) {
      return NextResponse.json(
        { message: 'You are already a host of this stream' },
        { status: 400 }
      )
    }

    // Check max hosts limit
    const currentHostsCount = await prisma.streamHost.count({
      where: { 
        streamId: streamId,
        leftAt: null,
      },
    })

    if (currentHostsCount >= (invite.stream.maxHosts || 4)) {
      return NextResponse.json(
        { message: 'Maximum number of hosts reached' },
        { status: 400 }
      )
    }

    // Add user as host
    const host = await prisma.streamHost.create({
      data: {
        streamId: streamId,
        userId: session.user.id,
        role: invite.role,
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

    // Increment invite usage count
    await prisma.hostInvite.update({
      where: { id: invite.id },
      data: { usedCount: invite.usedCount + 1 },
    })

    return NextResponse.json({
      success: true,
      host,
      stream: invite.stream,
      message: 'Successfully joined as host'
    })
  } catch (error) {
    console.error('Error validating invite:', error)
    return NextResponse.json(
      { message: 'Failed to validate invite' },
      { status: 500 }
    )
  }
}