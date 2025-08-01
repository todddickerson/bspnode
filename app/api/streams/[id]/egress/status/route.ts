import { NextRequest, NextResponse } from 'next/server'
import { EgressClient } from 'livekit-server-sdk'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const streamId = params.id

    // Check if we have the required environment variables
    const livekitUrl = process.env.LIVEKIT_API_URL || process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL
    if (!livekitUrl || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return NextResponse.json({
        error: 'LiveKit credentials not configured',
        hasEgress: false,
        details: 'Missing LIVEKIT URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET'
      }, { status: 500 })
    }

    const egressClient = new EgressClient(
      livekitUrl,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    )

    // List all egresses for this room to find the active one
    const egresses = await egressClient.listEgress({ roomName: streamId })
    
    // Find the most recent active egress
    const activeEgress = egresses.find(e => e.status === 'EGRESS_ACTIVE') || egresses[0]

    if (!activeEgress) {
      return NextResponse.json({
        error: 'No egress found',
        hasEgress: false
      })
    }

    // Map numeric status to string
    const statusMap: { [key: number]: string } = {
      0: 'EGRESS_PENDING',
      1: 'EGRESS_STARTING', 
      2: 'EGRESS_ACTIVE',
      3: 'EGRESS_ENDING',
      4: 'EGRESS_COMPLETE',
      5: 'EGRESS_FAILED'
    }

    const statusString = statusMap[activeEgress.status] || `UNKNOWN_${activeEgress.status}`
    const isActive = activeEgress.status === 2 // EGRESS_ACTIVE

    return NextResponse.json({
      egressId: activeEgress.egressId,
      status: activeEgress.status,
      statusString,
      roomName: activeEgress.roomName,
      startedAt: activeEgress.startedAt ? Number(activeEgress.startedAt) : null,
      updatedAt: activeEgress.updatedAt ? Number(activeEgress.updatedAt) : null,
      error: activeEgress.error || null,
      isActive,
      rtmpUrl: activeEgress.rtmp?.urls?.[0] || null,
      hasEgress: true
    })

  } catch (error) {
    console.error('Error getting egress status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get egress status',
        hasEgress: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}