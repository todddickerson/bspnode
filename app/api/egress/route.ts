import { NextRequest, NextResponse } from 'next/server'
import { egressClient } from '@/lib/livekit-enhanced'

export async function GET(request: NextRequest) {
  try {
    // List all active egresses
    const egressList = await egressClient.listEgress({
      active: true,
    })

    // Format the response with relevant information
    const activeEgresses = egressList.map(egress => ({
      egressId: egress.egressId,
      roomName: egress.roomName,
      roomId: egress.roomId,
      status: egress.status,
      startedAt: egress.startedAt,
      updatedAt: egress.updatedAt,
      streamOutputs: (egress as any).streamOutputs || [],
      fileOutputs: (egress as any).fileOutputs || [],
      error: egress.error,
    }))

    return NextResponse.json({
      success: true,
      count: activeEgresses.length,
      egresses: activeEgresses,
    })
  } catch (error) {
    console.error('Failed to list egresses:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list egresses',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}