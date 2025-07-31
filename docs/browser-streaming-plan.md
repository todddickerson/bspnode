# Browser-Based Streaming Implementation Plan

## Overview
We need to enable users to stream directly from their browser using their device's camera and microphone, rather than requiring external software like OBS.

## Current Limitations with Mux
- Mux primarily supports RTMP/RTMPS ingest, which requires external broadcasting software
- Browser-based streaming would require WebRTC → RTMP conversion
- Mux doesn't provide native WebRTC ingest endpoints

## Options Analysis

### Option 1: WebRTC to RTMP Bridge (with Mux)
- Use WebRTC to capture browser media
- Run a media server (like mediasoup or Janus) to convert WebRTC to RTMP
- Stream to Mux via RTMP
- **Pros**: Keep existing Mux infrastructure
- **Cons**: Complex setup, requires additional server infrastructure

### Option 2: Agora.io (Recommended for Browser Streaming)
- Native WebRTC support for browser-based streaming
- Built-in recording capabilities
- Real-time streaming with <400ms latency
- **Pros**: 
  - Easy browser integration
  - Built-in recording
  - Good free tier (10,000 minutes/month)
  - Handles WebRTC complexity
- **Cons**: 
  - More expensive than Mux at scale
  - Different API/SDK to learn

### Option 3: Daily.co
- WebRTC-based video API
- Browser SDK available
- Recording and streaming features
- **Pros**: Simple API, good documentation
- **Cons**: Pricing similar to Agora

### Option 4: Livekit
- Open-source WebRTC infrastructure
- Can self-host or use cloud
- Recording via Egress API
- **Pros**: Open source option available
- **Cons**: More complex setup if self-hosting

## Recommended Implementation (Agora)

### 1. Browser Streaming Flow
```
Browser → WebRTC → Agora → HLS/Recording → Viewers
```

### 2. Key Features to Implement
- [ ] Browser media capture (camera/mic)
- [ ] WebRTC streaming to Agora
- [ ] Live viewer count
- [ ] Stream recording
- [ ] Playback of recorded streams
- [ ] Stream state management (live/ended)
- [ ] Automatic recording playback when stream ends

### 3. Database Schema Updates
```prisma
model Stream {
  // ... existing fields
  
  // Agora-specific fields
  agoraAppId      String?
  agoraChannel    String?
  agoraToken      String?
  agoraUid        String?
  
  // Recording fields
  recordingUrl    String?
  recordingStatus RecordingStatus @default(NONE)
  duration        Int?            // in seconds
}

enum RecordingStatus {
  NONE
  RECORDING
  PROCESSING
  READY
  FAILED
}
```

### 4. Implementation Steps

#### Phase 1: Agora Integration
1. Set up Agora account and get credentials
2. Install Agora Web SDK
3. Create browser streaming component
4. Implement token generation endpoint

#### Phase 2: Browser Streaming
1. Create streaming interface with camera/mic preview
2. Implement WebRTC connection to Agora
3. Add stream controls (start/stop/mute)
4. Handle connection states and errors

#### Phase 3: Recording & Playback
1. Configure Agora Cloud Recording
2. Set up recording webhooks
3. Store recording URLs in database
4. Update viewer page to show recording when stream ends

#### Phase 4: Enhanced Features
1. Stream quality selection
2. Screen sharing option
3. Virtual backgrounds (optional)
4. Stream analytics

### 5. Cost Comparison

**For 1,000 hours of streaming/month:**
- Mux: ~$50-100 (RTMP ingest + storage + delivery)
- Agora: ~$150-200 (includes WebRTC + recording + storage)

**For small-scale usage (<100 hours/month):**
- Both services offer reasonable free tiers
- Agora's free tier: 10,000 minutes/month
- Mux's free tier: Limited, mainly for testing

### 6. Migration Strategy

Since we're in MVP stage, we can:
1. Keep Mux for RTMP-based streams (OBS users)
2. Add Agora for browser-based streams
3. Let users choose their streaming method
4. Eventually phase out less-used option

## Implementation Timeline

- **Day 1**: Agora setup, basic WebRTC streaming
- **Day 2**: Recording integration, playback switching
- **Day 3**: UI polish, error handling, testing
- **Day 4**: Performance optimization, mobile support

## Alternative: Simple P2P Approach

If cost is a major concern, we could implement a simpler P2P approach:
- Use WebRTC for direct peer connections
- No media server required
- Limited to small audience sizes
- No built-in recording

This would be essentially free but with significant limitations.