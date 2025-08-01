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

    // Find the active host record for this user and stream
    const activeHost = await prisma.streamHost.findFirst({
      where: {
        streamId: params.id,
        userId: session.user.id,
        leftAt: null,
      },
    })

    if (!activeHost) {
      return NextResponse.json(
        { message: 'You are not an active host of this stream' },
        { status: 404 }
      )
    }

    // Mark the host as left
    const updatedHost = await prisma.streamHost.update({
      where: { id: activeHost.id },
      data: { leftAt: new Date() },
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

    // If this was the stream owner leaving, check if we should end the stream
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (stream && stream.userId === session.user.id && stream.status === 'LIVE') {
      // Check if there are other active hosts
      const remainingHosts = await prisma.streamHost.count({
        where: {
          streamId: params.id,
          leftAt: null,
        },
      })

      // Only end the stream if the owner leaves and there are no other hosts
      if (remainingHosts === 0) {
        await prisma.stream.update({
          where: { id: params.id },
          data: {
            status: 'ENDED',
            endedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the studio',
      host: updatedHost,
    })
  } catch (error) {
    console.error('Error leaving stream:', error)
    return NextResponse.json(
      { message: 'Failed to leave stream' },
      { status: 500 }
    )
  }
}