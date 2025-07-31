# Hybrid Streaming Implementation Plan

## Overview
Support both streaming methods:
1. **RTMP Streaming** - For professional users with OBS/streaming software
2. **Browser Streaming** - For casual users who want to stream instantly

## Implementation Approach

### Database Schema Update
```prisma
model Stream {
  // ... existing fields
  
  // Streaming method
  streamType      StreamType @default(RTMP)
  
  // Browser streaming fields (Agora)
  agoraAppId      String?
  agoraChannel    String?
  agoraToken      String?
  
  // Recording fields
  recordingUrl    String?
  recordingStatus RecordingStatus @default(NONE)
  duration        Int?
}

enum StreamType {
  RTMP     // External software (OBS) → Mux
  BROWSER  // Browser WebRTC → Agora
}

enum RecordingStatus {
  NONE
  RECORDING
  PROCESSING
  READY
  FAILED
}
```

### User Flow

1. **Creating a Stream**
   - User chooses streaming method:
     - "Stream from Browser" (camera/mic)
     - "Stream with OBS/Software" (RTMP)

2. **RTMP Flow** (existing)
   - Generate RTMP URL + Stream Key
   - User configures OBS
   - Stream to Mux

3. **Browser Flow** (new)
   - Open in-browser streaming interface
   - Select camera/microphone
   - Click "Go Live"
   - Stream via WebRTC

### Implementation Steps

#### Phase 1: Update Stream Creation
1. Add stream type selection to dashboard
2. Update database schema
3. Modify API to handle both types

#### Phase 2: Browser Streaming with Agora
1. Add Agora SDK
2. Create browser streaming component
3. Implement WebRTC streaming
4. Add recording capability

#### Phase 3: Unified Viewer Experience
1. Detect stream type
2. Show appropriate player (Mux or Agora)
3. Switch to recording when stream ends
4. Consistent chat experience

## Quick Implementation for MVP

For now, we can use WebRTC peer-to-peer for browser streaming:
- Free (no server costs)
- Limited scalability
- Good enough for MVP testing

Later, we can upgrade to Agora or another service for production.