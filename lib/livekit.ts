import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk'

// LiveKit configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || ''
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

// Initialize LiveKit clients
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

// Export roomService for health checks
export { roomService }

export interface LiveKitTokenOptions {
  roomName: string
  participantName: string
  participantId: string
  canPublish?: boolean
  canSubscribe?: boolean
}

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateToken(options: LiveKitTokenOptions): Promise<string> {
  const {
    roomName,
    participantName,
    participantId,
    canPublish = true,
    canSubscribe = true,
  } = options

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantId,
    name: participantName,
  })

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe,
  })

  try {
    const jwt = await token.toJwt()
    return jwt
  } catch (error) {
    console.error('Error generating token:', error)
    throw error
  }
}

/**
 * Create a LiveKit room
 */
export async function createRoom(name: string, maxParticipants: number = 100) {
  try {
    const room = await roomService.createRoom({
      name,
      maxParticipants,
      // Enable recording by default
      metadata: JSON.stringify({
        enableRecording: true,
      }),
    })
    return room
  } catch (error) {
    console.error('Failed to create LiveKit room:', error)
    throw error
  }
}

/**
 * Delete a LiveKit room
 */
export async function deleteRoom(roomName: string) {
  try {
    await roomService.deleteRoom(roomName)
  } catch (error) {
    console.error('Failed to delete LiveKit room:', error)
    // Room might already be deleted
  }
}

/**
 * Start RTMP egress for a room (for viewers)
 */
export async function startRtmpEgress(roomName: string, rtmpUrl: string) {
  try {
    const egress = await egressClient.startRoomCompositeEgress({
      roomName,
      layout: 'grid',
      stream: [{
        urls: [rtmpUrl],
      }],
    })
    return egress
  } catch (error) {
    console.error('Failed to start RTMP egress:', error)
    throw error
  }
}

/**
 * Start recording for a room
 */
export async function startRecording(roomName: string) {
  try {
    const egress = await egressClient.startRoomCompositeEgress({
      roomName,
      layout: 'grid',
      file: {
        outputType: 'mp4',
      },
    })
    return egress
  } catch (error) {
    console.error('Failed to start recording:', error)
    throw error
  }
}

/**
 * Stop an egress (recording or streaming)
 */
export async function stopEgress(egressId: string) {
  try {
    await egressClient.stopEgress(egressId)
  } catch (error) {
    console.error('Failed to stop egress:', error)
    // Egress might already be stopped
  }
}

/**
 * List participants in a room
 */
export async function listParticipants(roomName: string) {
  try {
    const participants = await roomService.listParticipants(roomName)
    return participants
  } catch (error) {
    console.error('Failed to list participants:', error)
    return []
  }
}

export const livekit = {
  generateToken,
  createRoom,
  deleteRoom,
  startRtmpEgress,
  startRecording,
  stopEgress,
  listParticipants,
}