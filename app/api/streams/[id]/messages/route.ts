import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const streamId = params.id

    const messages = await prisma.message.findMany({
      where: {
        streamId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 100 // Limit to last 100 messages
    })

    const formattedMessages = messages.map(message => ({
      id: message.id,
      content: message.content,
      user: message.user,
      createdAt: message.createdAt.toISOString()
    }))

    return NextResponse.json(formattedMessages)
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}