import { useEffect, useRef, useCallback } from 'react'
import { Room, RoomEvent, TrackPublication, Participant, Track } from 'livekit-client'

interface TrackChangeEvent {
  participant: Participant
  publication: TrackPublication
  track?: Track
  type: 'published' | 'unpublished' | 'subscribed' | 'unsubscribed'
}

interface UseTrackMonitorOptions {
  room: Room | null
  onTrackChange?: (event: TrackChangeEvent) => void
  onVideoTrackChange?: (event: TrackChangeEvent) => void
  onAudioTrackChange?: (event: TrackChangeEvent) => void
  monitorLocalTracks?: boolean
  monitorRemoteTracks?: boolean
}

export function useTrackMonitor({
  room,
  onTrackChange,
  onVideoTrackChange,
  onAudioTrackChange,
  monitorLocalTracks = true,
  monitorRemoteTracks = false,
}: UseTrackMonitorOptions) {
  const previousTracks = useRef<Map<string, Set<string>>>(new Map())
  
  const handleTrackEvent = useCallback((
    participant: Participant,
    publication: TrackPublication,
    track: Track | undefined,
    type: TrackChangeEvent['type']
  ) => {
    const event: TrackChangeEvent = { participant, publication, track, type }
    
    // Call general track change handler
    onTrackChange?.(event)
    
    // Call specific track type handlers
    if (publication.kind === Track.Kind.Video) {
      onVideoTrackChange?.(event)
    } else if (publication.kind === Track.Kind.Audio) {
      onAudioTrackChange?.(event)
    }
    
    console.log(`Track ${type}:`, {
      participantId: participant?.sid || 'unknown',
      trackId: publication?.trackSid || 'unknown',
      kind: publication?.kind || 'unknown',
      source: publication?.source || 'unknown',
    })
  }, [onTrackChange, onVideoTrackChange, onAudioTrackChange])

  useEffect(() => {
    if (!room) return

    const cleanup: (() => void)[] = []

    if (monitorLocalTracks) {
      // Monitor local participant track changes
      const onLocalTrackPublished = (publication: TrackPublication, participant: Participant) => {
        handleTrackEvent(participant, publication, publication.track, 'published')
      }

      const onLocalTrackUnpublished = (publication: TrackPublication, participant: Participant) => {
        handleTrackEvent(participant, publication, undefined, 'unpublished')
      }

      room.localParticipant.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
      room.localParticipant.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished)

      cleanup.push(() => {
        room.localParticipant.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
        room.localParticipant.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished)
      })
    }

    if (monitorRemoteTracks) {
      // Monitor remote participant track changes
      const onTrackSubscribed = (track: Track, publication: TrackPublication, participant: Participant) => {
        handleTrackEvent(participant, publication, track, 'subscribed')
      }

      const onTrackUnsubscribed = (track: Track, publication: TrackPublication, participant: Participant) => {
        handleTrackEvent(participant, publication, track, 'unsubscribed')
      }

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)

      cleanup.push(() => {
        room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
        room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      })
    }

    return () => {
      cleanup.forEach(fn => fn())
    }
  }, [room, handleTrackEvent, monitorLocalTracks, monitorRemoteTracks])

  return {
    getCurrentTracks: useCallback(() => {
      if (!room || !room.localParticipant) return { video: null, audio: null }
      
      const localParticipant = room.localParticipant
      
      // Check if videoTracks and audioTracks exist and have values() method
      const videoTrack = localParticipant.videoTracks && localParticipant.videoTracks.values
        ? Array.from(localParticipant.videoTracks.values())[0]
        : null
      const audioTrack = localParticipant.audioTracks && localParticipant.audioTracks.values
        ? Array.from(localParticipant.audioTracks.values())[0]
        : null
      
      return {
        video: videoTrack || null,
        audio: audioTrack || null,
      }
    }, [room])
  }
}