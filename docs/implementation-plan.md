# BSPNode Hybrid Streaming Implementation Plan

## Executive Summary

We'll implement a hybrid streaming solution that supports both:
1. **RTMP Streaming** (via OBS/external software) - Already working with Mux
2. **Browser Streaming** (via WebRTC) - New feature using a cost-effective approach

## Architecture Decision

After thorough analysis, we'll implement a **progressive enhancement approach**:

### Phase 1 (Immediate): Simple WebRTC with Mux Recording
- Use native WebRTC for browser capture
- MediaRecorder API for local recording
- Upload recordings to Mux as VOD assets
- Cost: No additional cost (uses existing Mux account)

### Phase 2 (Future): Add Agora for scale
- When we need >10 concurrent viewers for browser streams
- When we need cloud recording
- Estimated additional cost: ~$100-150/month

## Detailed Implementation Plan

### 1. Database Schema Updates

```prisma
// Add to existing Stream model
model Stream {
  // ... existing fields
  
  // Streaming type
  streamType      StreamType @default(RTMP)
  
  // Browser streaming fields
  recordingUrl    String?     // URL of recorded stream
  recordingStatus RecordingStatus @default(NONE)
  recordingId     String?     // Mux asset ID for recording
  duration        Int?        // Duration in seconds
  
  // WebRTC signaling
  webrtcOffer     String?     @db.Text // For P2P streaming
  webrtcAnswer    String?     @db.Text
}

enum StreamType {
  RTMP     // Professional streaming via OBS
  BROWSER  // Browser-based streaming
}

enum RecordingStatus {
  NONE
  RECORDING
  UPLOADING
  PROCESSING
  READY
  FAILED
}
```

### 2. User Interface Flow

#### A. Stream Creation (Dashboard)
```
[Create New Stream]
    ↓
[Choose Streaming Method]
    ├── "Go Live from Browser" 
    │   └── Create stream → Open browser streaming page
    └── "Stream with OBS/Software"
        └── Create stream → Show RTMP credentials
```

#### B. Browser Streaming Interface
```
/stream/[id]/broadcast
├── Camera/Mic Preview
├── Stream Settings (quality, camera selection)
├── Go Live button
├── Live indicators (duration, viewers)
└── End Stream button
```

#### C. Viewer Experience
```
/stream/[id]
├── If LIVE + RTMP → Mux Player (HLS)
├── If LIVE + BROWSER → WebRTC viewer
├── If ENDED + has recording → Mux Player (VOD)
└── If ENDED + no recording → "Stream has ended" message
```

### 3. Technical Implementation

#### Phase 1 Components

**A. Browser Streaming Page** (`/app/stream/[id]/broadcast/page.tsx`)
- Camera/microphone selection
- Local preview
- MediaRecorder for local recording
- Upload to Mux when stream ends

**B. WebRTC Streaming Hook** (`/hooks/useWebRTCStream.ts`)
- Handle getUserMedia
- Manage MediaRecorder
- Handle stream states

**C. Recording Upload API** (`/app/api/streams/[id]/upload-recording/route.ts`)
- Accept recorded blob
- Create Mux upload
- Update database with asset ID

**D. Updated Viewer Logic**
- Check stream type
- Show appropriate player
- Fallback to recording when available

### 4. Implementation Steps (Ordered)

1. **Update Database Schema** ✓
   - Add new fields for stream type and recording
   - Run migrations

2. **Update Stream Creation UI**
   - Add streaming method selection
   - Update API to handle stream type

3. **Build Browser Streaming Interface**
   - Create broadcast page
   - Implement camera/mic preview
   - Add recording capability

4. **Implement Recording Upload**
   - Create upload endpoint
   - Integrate with Mux Assets API
   - Handle processing webhooks

5. **Update Viewer Page**
   - Detect stream type and status
   - Show appropriate player
   - Implement recording playback

6. **Add P2P WebRTC** (Optional for MVP)
   - Simple 1-to-1 streaming
   - For testing without recording

### 5. Cost Analysis

**Current Costs (RTMP only)**
- Mux Live Streaming: $0.05/minute
- Mux Storage: $0.007/GB/month
- Mux Delivery: $0.01/GB

**Added Costs (Browser Streaming)**
- Recording Processing: $0.05/minute (same as live)
- No additional streaming costs for Phase 1

**Total Monthly Cost Estimate**
- 100 hours streaming: ~$300
- 1000 hours streaming: ~$3000

### 6. MVP Simplification

For the immediate MVP, we can:
1. Skip P2P WebRTC (just do recording + VOD)
2. Limit recording to 30 minutes max
3. Auto-end streams after 2 hours
4. Basic UI without fancy controls

### 7. Security Considerations

- Validate stream ownership before broadcasting
- Implement upload size limits
- Add rate limiting to prevent abuse
- Secure WebRTC signaling

### 8. Future Enhancements

1. **Add Agora Integration**
   - For >10 concurrent viewers
   - Cloud recording
   - Better quality control

2. **Advanced Features**
   - Screen sharing
   - Multi-host streams
   - Stream scheduling
   - Monetization

3. **Analytics**
   - Viewer engagement
   - Stream quality metrics
   - Revenue tracking

## Next Steps

1. ✅ Exploration complete
2. ✅ Architecture designed
3. 🔄 Start implementation with database schema
4. 🔄 Build UI components progressively
5. 🔄 Test with real streaming