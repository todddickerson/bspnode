import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stream_id = searchParams.get('stream_id')
    
    if (!stream_id) {
      return NextResponse.json({ error: 'Missing stream_id' }, { status: 400 })
    }

    console.log('🔍 Getting messages for stream:', stream_id, 'hasSupabase:', !!supabase)

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not available' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('stream_id', stream_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error getting messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Messages retrieved:', data?.length || 0, 'messages')
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('❌ Get messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}