import { NextRequest, NextResponse } from 'next/server'
import { stopEgressGracefully } from '@/lib/livekit-enhanced'

export async function POST(
  request: NextRequest,
  { params }: { params: { egressId: string } }
) {
  try {
    const { egressId } = params

    if (!egressId) {
      return NextResponse.json(
        { success: false, error: 'Egress ID is required' },
        { status: 400 }
      )
    }

    console.log(`Stopping egress: ${egressId}`)

    // Stop the egress with retry logic
    const stopped = await stopEgressGracefully(egressId, 3)

    if (stopped) {
      return NextResponse.json({
        success: true,
        message: `Egress ${egressId} stopped successfully`,
        egressId,
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to stop egress after multiple attempts',
          egressId,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Failed to stop egress:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to stop egress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}