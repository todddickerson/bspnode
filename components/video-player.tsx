'use client'

import MuxPlayer from '@mux/mux-player-react'
import { useState, useEffect } from 'react'

interface VideoPlayerProps {
  playbackId: string
  title: string
  isLive?: boolean
}

export function VideoPlayer({ playbackId, title, isLive = false }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false)
  
  // Reset error state when playbackId changes
  useEffect(() => {
    setHasError(false)
    console.log('VideoPlayer: playbackId changed to:', playbackId)
  }, [playbackId])
  
  // Don't render the player if there's no valid playback ID
  if (!playbackId || playbackId === 'null' || playbackId === 'undefined') {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-lg">No video available</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {hasError ? (
        <div className="aspect-video flex items-center justify-center">
          <div className="text-white text-center">
            <p className="text-lg mb-2">Unable to load video</p>
            <p className="text-sm text-gray-400">The video may still be processing</p>
          </div>
        </div>
      ) : (
        <MuxPlayer
          playbackId={playbackId}
          metadata={{
            video_title: title,
          }}
          streamType={isLive ? "live" : "on-demand"}
          autoPlay
          muted
          // Disable pause/play controls for live streams
          paused={false}
          // Hide play button and prevent spacebar pause for live streams
          nohotkeys={isLive}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            // Prevent click-to-pause for live streams
            pointerEvents: isLive ? 'none' : 'auto'
          }}
          onError={(error) => {
            console.error('MuxPlayer error:', error)
            setHasError(true)
          }}
          onLoadStart={() => {
            console.log('MuxPlayer: Load started for', playbackId)
          }}
          onCanPlay={() => {
            console.log('MuxPlayer: Can play', playbackId)
            setHasError(false)
          }}
        />
      )}
    </div>
  )
}