import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { stream_id, content } = await request.json()
    
    if (!stream_id || !content) {
      return NextResponse.json({ error: 'Missing stream_id or content' }, { status: 400 })
    }

    console.log('🧪 Test message API called:', { stream_id, content, hasSupabaseAdmin: !!supabaseAdmin })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 })
    }

    const message = {
      stream_id,
      user_id: 'test-user',
      user_name: 'Test User',
      content: content
    }

    console.log('🧪 Inserting test message:', message)

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert([message])
      .select()

    if (error) {
      console.error('❌ Error inserting test message:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Test message inserted successfully:', data)
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('❌ Test message API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}