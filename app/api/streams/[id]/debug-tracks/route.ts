import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/lib/livekit-enhanced'
import { prisma } from '@/lib/prisma'

// Helper functions to convert enum values to strings
function getTrackTypeString(type: any): string {
  switch (Number(type)) {
    case 0: return 'AUDIO'
    case 1: return 'VIDEO'
    case 2: return 'DATA'
    default: return `UNKNOWN(${type})`
  }
}

function getTrackSourceString(source: any): string {
  switch (Number(source)) {
    case 0: return 'UNKNOWN'
    case 1: return 'CAMERA'
    case 2: return 'MICROPHONE'
    case 3: return 'SCREEN_SHARE'
    case 4: return 'SCREEN_SHARE_AUDIO'
    default: return `UNKNOWN(${source})`
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
      select: {
        liveKitRoomName: true,
        status: true,
      }
    })

    if (!stream || !stream.liveKitRoomName) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    }

    // Get participants and their tracks
    const participants = await roomService.listParticipants(stream.liveKitRoomName)
    
    const participantInfo = participants.map(p => ({
      sid: p.sid,
      identity: p.identity,
      name: p.name,
      isPublisher: p.permission?.canPublish || false,
      connectionQuality: p.connectionQuality,
      joinedAt: p.joinedAt ? Number(p.joinedAt) : null,
      tracks: p.tracks?.map(t => ({
        sid: t.sid,
        type: t.type,
        typeString: getTrackTypeString(t.type),
        source: t.source,
        sourceString: getTrackSourceString(t.source),
        muted: t.muted,
        simulcast: t.simulcast,
        width: t.width,
        height: t.height,
        frameRate: t.frameRate,
        mimeType: t.mimeType,
      })) || []
    }))

    return NextResponse.json({
      streamStatus: stream.status,
      roomName: stream.liveKitRoomName,
      participantCount: participants.length,
      participants: participantInfo,
      hasPublisher: participantInfo.some(p => p.isPublisher),
      publisherHasVideo: participantInfo.some(p => 
        p.isPublisher && p.tracks.some(t => Number(t.type) === 1 && !t.muted)
      ),
      publisherHasAudio: participantInfo.some(p => 
        p.isPublisher && p.tracks.some(t => Number(t.type) === 0 && !t.muted)
      ),
    })
  } catch (error) {
    console.error('Error getting track info:', error)
    return NextResponse.json(
      { error: 'Failed to get track info' },
      { status: 500 }
    )
  }
}