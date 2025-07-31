'use client'

import MuxPlayer from '@mux/mux-player-react'
import { useState } from 'react'

interface VideoPlayerProps {
  playbackId: string
  title: string
  isLive?: boolean
}

export function VideoPlayer({ playbackId, title, isLive = false }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false)
  
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
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
          }}
          onError={() => setHasError(true)}
        />
      )}
      {isLive && !hasError && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold">
          LIVE
        </div>
      )}
    </div>
  )
}