import { useCallback } from 'react'
import { Room, Track } from 'livekit-client'
import { useTrackMonitor } from './use-track-monitor'
import { useEgressMonitor } from './use-egress-monitor'

interface UseStreamingMonitorOptions {
  streamId: string
  room: Room | null
  isLive: boolean
  onTrackChanged?: (trackType: 'video' | 'audio', action: string) => void
  onEgressRestarted?: (reason: string) => void
  onStreamingError?: (error: string) => void
}

export function useStreamingMonitor({
  streamId,
  room,
  isLive,
  onTrackChanged,
  onEgressRestarted,
  onStreamingError,
}: UseStreamingMonitorOptions) {
  
  // Handle video track changes with egress restart
  const handleVideoTrackChange = useCallback((event: any) => {
    const { type, publication } = event
    
    console.log(`Video track ${type}:`, {
      trackId: publication.trackSid,
      source: publication.source,
    })
    
    onTrackChanged?.('video', type)
    
    // If a video track was unpublished or a new one published, restart egress
    if (type === 'published' || type === 'unpublished') {
      scheduleEgressRestart(`Video track ${type}`, 1500) // Shorter delay for track changes
    }
  }, [onTrackChanged])

  // Handle audio track changes
  const handleAudioTrackChange = useCallback((event: any) => {
    const { type, publication } = event
    
    console.log(`Audio track ${type}:`, {
      trackId: publication.trackSid,
      source: publication.source,
    })
    
    onTrackChanged?.('audio', type)
    
    // Audio track changes might also need egress restart in some cases
    if (type === 'published' || type === 'unpublished') {
      scheduleEgressRestart(`Audio track ${type}`, 2000)
    }
  }, [onTrackChanged])

  // Set up track monitoring
  const { getCurrentTracks } = useTrackMonitor({
    room,
    onVideoTrackChange: handleVideoTrackChange,
    onAudioTrackChange: handleAudioTrackChange,
    monitorLocalTracks: true,
    monitorRemoteTracks: false,
  })

  // Set up egress monitoring with restart capability
  const { 
    egressStatus, 
    restartEgress, 
    scheduleEgressRestart, 
    checkEgressConnection 
  } = useEgressMonitor({
    streamId,
    room,
    isLive,
    onEgressRestart: (reason) => {
      console.log(`🔄 Egress restarted: ${reason}`)
      onEgressRestarted?.(reason)
    },
    onEgressError: (error) => {
      console.error(`❌ Egress error: ${error}`)
      onStreamingError?.(error)
    },
    restartDelay: 2000,
    maxRestarts: 3,
  })

  return {
    // Track info
    currentTracks: getCurrentTracks(),
    
    // Egress status
    egressStatus,
    isEgressConnected: egressStatus.isConnected,
    isEgressReconnecting: egressStatus.isReconnecting,
    egressError: egressStatus.error,
    
    // Manual controls
    restartEgress,
    checkEgressConnection,
    
    // Utility functions
    getStreamingHealth: useCallback(() => {
      try {
        const tracks = getCurrentTracks()
        return {
          hasVideo: !!tracks.video?.track,
          hasAudio: !!tracks.audio?.track,
          egressConnected: egressStatus.isConnected,
          isHealthy: egressStatus.isConnected && (!!tracks.video?.track || !!tracks.audio?.track),
          issues: [
            !egressStatus.isConnected && 'Egress disconnected',
            !tracks.video?.track && 'No video track',
            !tracks.audio?.track && 'No audio track',
            egressStatus.error && `Error: ${egressStatus.error}`,
          ].filter(Boolean),
        }
      } catch (error) {
        console.error('Error getting streaming health:', error)
        return {
          hasVideo: false,
          hasAudio: false,
          egressConnected: egressStatus.isConnected,
          isHealthy: false,
          issues: ['Room not ready'],
        }
      }
    }, [getCurrentTracks, egressStatus]),
  }
}