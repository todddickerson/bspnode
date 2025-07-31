import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
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

    if (!stream) {
      return NextResponse.json(
        { message: 'Stream not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(stream)
  } catch (error) {
    console.error('Error fetching stream:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}