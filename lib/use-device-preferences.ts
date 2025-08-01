import { useEffect, useState, useCallback } from 'react'

interface DevicePreferences {
  videoDeviceId?: string
  audioDeviceId?: string
  videoEnabled?: boolean
  audioEnabled?: boolean
}

const STORAGE_KEY = 'streaming-device-preferences'

export function useDevicePreferences() {
  const [preferences, setPreferences] = useState<DevicePreferences>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences(parsed)
      }
    } catch (error) {
      console.error('Error loading device preferences:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: Partial<DevicePreferences>) => {
    try {
      const updated = { ...preferences, ...newPreferences }
      setPreferences(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      console.log('Device preferences saved:', updated)
    } catch (error) {
      console.error('Error saving device preferences:', error)
    }
  }, [preferences])

  // Get the preferred device or fall back to first available
  const getPreferredDevice = useCallback((
    devices: MediaDeviceInfo[],
    deviceType: 'videoinput' | 'audioinput',
    fallbackToFirst: boolean = true
  ): MediaDeviceInfo | null => {
    if (!devices || devices.length === 0) return null

    const filteredDevices = devices.filter(device => device.kind === deviceType)
    if (filteredDevices.length === 0) return null

    // Get preferred device ID from preferences
    const preferredId = deviceType === 'videoinput' 
      ? preferences.videoDeviceId 
      : preferences.audioDeviceId

    // Try to find the preferred device
    if (preferredId) {
      const preferredDevice = filteredDevices.find(device => device.deviceId === preferredId)
      if (preferredDevice) {
        return preferredDevice
      }
    }

    // Fall back to first device if enabled
    if (fallbackToFirst) {
      return filteredDevices[0]
    }

    return null
  }, [preferences])

  // Save video device preference
  const saveVideoDevice = useCallback((deviceId: string) => {
    savePreferences({ videoDeviceId: deviceId })
  }, [savePreferences])

  // Save audio device preference
  const saveAudioDevice = useCallback((deviceId: string) => {
    savePreferences({ audioDeviceId: deviceId })
  }, [savePreferences])

  // Save enabled/disabled state
  const saveVideoEnabled = useCallback((enabled: boolean) => {
    savePreferences({ videoEnabled: enabled })
  }, [savePreferences])

  const saveAudioEnabled = useCallback((enabled: boolean) => {
    savePreferences({ audioEnabled: enabled })
  }, [savePreferences])

  return {
    preferences,
    isLoaded,
    saveVideoDevice,
    saveAudioDevice,
    saveVideoEnabled,
    saveAudioEnabled,
    getPreferredDevice,
    
    // Convenience getters
    preferredVideoDeviceId: preferences.videoDeviceId,
    preferredAudioDeviceId: preferences.audioDeviceId,
    videoEnabled: preferences.videoEnabled ?? true, // Default to enabled
    audioEnabled: preferences.audioEnabled ?? true, // Default to enabled
  }
}