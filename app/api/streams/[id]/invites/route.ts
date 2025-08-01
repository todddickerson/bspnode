import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

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

    // Get the stream to check ownership
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    // Check if user is stream owner or host
    const isStreamOwner = stream.userId === session.user.id
    const isHost = await prisma.streamHost.findFirst({
      where: {
        streamId: params.id,
        userId: session.user.id,
        leftAt: null,
      },
    })

    if (!isStreamOwner && !isHost) {
      return NextResponse.json(
        { message: 'You must be the stream owner or a host to view invites' },
        { status: 403 }
      )
    }

    // Get active invites for the stream
    const invites = await prisma.hostInvite.findMany({
      where: { 
        streamId: params.id,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Use NEXTAUTH_URL if available, otherwise fallback to request origin
    const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin

    // Add invite URLs to each invite
    const invitesWithUrls = invites.map(invite => ({
      ...invite,
      inviteUrl: `${baseUrl}/stream/${params.id}/join?token=${invite.token}`
    }))

    return NextResponse.json(invitesWithUrls)
  } catch (error) {
    console.error('Error fetching invites:', error)
    return NextResponse.json(
      { message: 'Failed to fetch invites' },
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

    const { 
      role = 'HOST', 
      maxUses = 1, 
      expiresInHours = 24 
    } = await req.json()

    // Get the stream to check ownership
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    // Check if user is stream owner
    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Only the stream owner can create invites' },
        { status: 403 }
      )
    }

    // Check if stream supports multiple hosts
    if (stream.streamType !== 'LIVEKIT') {
      return NextResponse.json(
        { message: 'This stream does not support multiple hosts' },
        { status: 400 }
      )
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex')
    
    // Calculate expiration date
    const expiresAt = expiresInHours > 0 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null

    // Create invite
    const invite = await prisma.hostInvite.create({
      data: {
        token,
        streamId: params.id,
        createdBy: session.user.id,
        role,
        maxUses,
        expiresAt,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Use NEXTAUTH_URL if available, otherwise fallback to request origin
    const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin
    
    return NextResponse.json({
      ...invite,
      inviteUrl: `${baseUrl}/stream/${params.id}/join?token=${token}`
    })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json(
      { message: 'Failed to create invite' },
      { status: 500 }
    )
  }
}