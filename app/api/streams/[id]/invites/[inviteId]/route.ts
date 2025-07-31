import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; inviteId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the invite to check ownership
    const invite = await prisma.hostInvite.findUnique({
      where: { id: params.inviteId },
      include: {
        stream: true,
      },
    })

    if (!invite) {
      return NextResponse.json(
        { message: 'Invite not found' },
        { status: 404 }
      )
    }

    // Check if user is stream owner or invite creator
    const isStreamOwner = invite.stream.userId === session.user.id
    const isInviteCreator = invite.createdBy === session.user.id

    if (!isStreamOwner && !isInviteCreator) {
      return NextResponse.json(
        { message: 'You can only revoke your own invites or invites for your streams' },
        { status: 403 }
      )
    }

    // Deactivate the invite
    await prisma.hostInvite.update({
      where: { id: params.inviteId },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Invite revoked successfully' })
  } catch (error) {
    console.error('Error revoking invite:', error)
    return NextResponse.json(
      { message: 'Failed to revoke invite' },
      { status: 500 }
    )
  }
}