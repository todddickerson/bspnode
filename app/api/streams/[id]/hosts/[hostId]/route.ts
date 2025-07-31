import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; hostId: string } }
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

    // Get the host to be removed
    const hostToRemove = await prisma.streamHost.findUnique({
      where: { id: params.hostId },
      include: { user: true },
    })

    if (!hostToRemove) {
      return NextResponse.json(
        { message: 'Host not found' },
        { status: 404 }
      )
    }

    // Check permissions: only stream owner can remove hosts
    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Only the stream owner can remove hosts' },
        { status: 403 }
      )
    }

    // Don't allow removing the stream owner
    if (hostToRemove.userId === stream.userId) {
      return NextResponse.json(
        { message: 'Cannot remove the stream owner' },
        { status: 400 }
      )
    }

    // Mark host as left
    await prisma.streamHost.update({
      where: { id: params.hostId },
      data: { leftAt: new Date() },
    })

    // Optional: Revoke any active invites for this user
    await prisma.hostInvite.updateMany({
      where: {
        streamId: params.id,
        createdBy: hostToRemove.userId,
        isActive: true,
      },
      data: { isActive: false },
    })

    return NextResponse.json({ 
      message: 'Host removed successfully',
      removedHost: {
        id: hostToRemove.id,
        name: hostToRemove.user.name,
      }
    })
  } catch (error) {
    console.error('Error removing host:', error)
    return NextResponse.json(
      { message: 'Failed to remove host' },
      { status: 500 }
    )
  }
}