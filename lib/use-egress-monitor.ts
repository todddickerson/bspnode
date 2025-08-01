import { useEffect, useRef, useCallback, useState } from 'react'
import { Room, Track } from 'livekit-client'

interface EgressStatus {
  isConnected: boolean
  isReconnecting: boolean
  lastRestartTime: number | null
  restartCount: number
  error: string | null
}

interface UseEgressMonitorOptions {
  streamId: string
  room: Room | null
  isLive: boolean
  onEgressRestart?: (reason: string) => void
  onEgressError?: (error: string) => void
  restartDelay?: number
  maxRestarts?: number
}

export function useEgressMonitor({
  streamId,
  room,
  isLive,
  onEgressRestart,
  onEgressError,
  restartDelay = 2000,
  maxRestarts = 3
}: UseEgressMonitorOptions) {
  const [egressStatus, setEgressStatus] = useState<EgressStatus>({
    isConnected: false,
    isReconnecting: false,
    lastRestartTime: null,
    restartCount: 0,
    error: null,
  })

  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if egress participant is connected to the room
  const checkEgressConnection = useCallback(async () => {
    if (!room || !isLive) return false

    try {
      const response = await fetch(`/api/streams/${streamId}/debug-tracks`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check egress status')
      }

      // Look for egress participant (identity starts with "EG_")
      const egressParticipant = data.participants?.find((p: any) => 
        p.identity.startsWith('EG_')
      )

      const isConnected = !!egressParticipant
      const hasPublisherVideo = data.publisherHasVideo
      const hasPublisherAudio = data.publisherHasAudio

      // Update status
      setEgressStatus(prev => ({
        ...prev,
        isConnected,
        error: isConnected ? null : prev.error,
      }))

      // If egress is missing but stream is live and has video/audio, restart
      if (!isConnected && isLive && (hasPublisherVideo || hasPublisherAudio)) {
        return false // Needs restart
      }

      return isConnected
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error checking egress connection:', errorMessage)
      
      setEgressStatus(prev => ({ ...prev, error: errorMessage }))
      onEgressError?.(errorMessage)
      return false
    }
  }, [room, isLive, streamId, onEgressError])

  // Restart RTMP egress
  const restartEgress = useCallback(async (reason: string) => {
    if (!isLive || egressStatus.isReconnecting) return false

    // Check restart limits
    const now = Date.now()
    const timeSinceLastRestart = egressStatus.lastRestartTime 
      ? now - egressStatus.lastRestartTime 
      : Infinity

    // Reset restart count if enough time has passed (5 minutes)
    const shouldResetCount = timeSinceLastRestart > 5 * 60 * 1000
    const currentRestartCount = shouldResetCount ? 0 : egressStatus.restartCount

    if (currentRestartCount >= maxRestarts) {
      const errorMessage = `Max restart attempts (${maxRestarts}) reached`
      setEgressStatus(prev => ({ ...prev, error: errorMessage }))
      onEgressError?.(errorMessage)
      return false
    }

    console.log(`Restarting RTMP egress: ${reason} (attempt ${currentRestartCount + 1}/${maxRestarts})`)

    setEgressStatus(prev => ({
      ...prev,
      isReconnecting: true,
      restartCount: currentRestartCount + 1,
      lastRestartTime: now,
      error: null,
    }))

    try {
      const response = await fetch(`/api/streams/${streamId}/egress/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Egress restart failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Egress restarted successfully:', result)

      onEgressRestart?.(reason)

      // Wait a moment for egress to connect, then check status
      setTimeout(async () => {
        const isConnected = await checkEgressConnection()
        setEgressStatus(prev => ({
          ...prev,
          isReconnecting: false,
          isConnected,
        }))
      }, 3000)

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Egress restart failed'
      console.error('Error restarting egress:', errorMessage)
      
      setEgressStatus(prev => ({
        ...prev,
        isReconnecting: false,
        error: errorMessage,
      }))
      
      onEgressError?.(errorMessage)
      return false
    }
  }, [streamId, isLive, egressStatus.isReconnecting, egressStatus.restartCount, egressStatus.lastRestartTime, maxRestarts, onEgressRestart, onEgressError, checkEgressConnection])

  // Schedule egress restart with delay
  const scheduleEgressRestart = useCallback((reason: string, delay: number = restartDelay) => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
    }

    restartTimeoutRef.current = setTimeout(() => {
      restartEgress(reason)
    }, delay)
  }, [restartEgress, restartDelay])

  // Monitor egress connection periodically
  useEffect(() => {
    if (!isLive || !room) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
      return
    }

    // Initial check
    checkEgressConnection()

    // Set up periodic monitoring
    checkIntervalRef.current = setInterval(async () => {
      const isConnected = await checkEgressConnection()
      
      // If egress is disconnected and we're not already restarting, schedule restart
      if (!isConnected && !egressStatus.isReconnecting) {
        scheduleEgressRestart('Egress connection lost', restartDelay)
      }
    }, 10000) // Check every 10 seconds

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [isLive, room, checkEgressConnection, scheduleEgressRestart, egressStatus.isReconnecting, restartDelay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [])

  return {
    egressStatus,
    restartEgress: (reason: string) => restartEgress(reason),
    scheduleEgressRestart,
    checkEgressConnection,
  }
}