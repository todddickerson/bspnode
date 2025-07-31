import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const streamId = params.id

  if (!supabaseAdmin) {
    return NextResponse.json(
      { message: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    // First, ensure stream stats record exists
    const { data: existingStats } = await supabaseAdmin
      .from('stream_stats')
      .select('heart_count')
      .eq('stream_id', streamId)
      .single()

    if (!existingStats) {
      // Create initial stats record
      await supabaseAdmin
        .from('stream_stats')
        .insert({ stream_id: streamId, heart_count: 1 })
    } else {
      // Increment heart count
      await supabaseAdmin
        .from('stream_stats')
        .update({ heart_count: existingStats.heart_count + 1 })
        .eq('stream_id', streamId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating heart count:', error)
    return NextResponse.json(
      { message: 'Failed to send heart' },
      { status: 500 }
    )
  }
}