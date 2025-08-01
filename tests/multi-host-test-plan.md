# Multi-Host Test Plan

## Test Scenarios

### 1. Basic Multi-Host Flow
- [ ] Create a LiveKit stream as owner
- [ ] Generate host invite link
- [ ] Join as second host using invite link
- [ ] Verify both hosts see each other's video
- [ ] Verify host list shows both users with green status indicators
- [ ] Check that video grid adjusts properly (2 columns for 2 hosts)

### 2. Host Leave & Rejoin
- [ ] Have a host click "Leave Studio"
- [ ] Verify their status indicator turns gray in host list
- [ ] Verify they receive "Host Left" notification
- [ ] Have the same host navigate back to studio URL
- [ ] Verify they can rejoin without needing a new invite
- [ ] Verify their video reappears for other hosts

### 3. Connection Issues
- [ ] Simulate network disconnect (disable network briefly)
- [ ] Verify "Reconnecting..." toast appears
- [ ] Re-enable network
- [ ] Verify "Reconnected" toast appears
- [ ] Verify video resumes for all participants

### 4. Multiple Hosts (3+)
- [ ] Add 3-4 hosts to a stream
- [ ] Verify video grid adjusts (3 columns for 4+ hosts)
- [ ] Verify all hosts see each other
- [ ] Verify host list shows all participants with proper status

### 5. Host Management
- [ ] As stream owner, remove a host using X button
- [ ] Verify removed host is disconnected
- [ ] Verify they cannot rejoin without new invite
- [ ] Create new invite and verify they can join again

### 6. Edge Cases
- [ ] Try joining with expired invite - should fail
- [ ] Try joining when already a host - should redirect to studio
- [ ] Leave studio and immediately try to rejoin - should work
- [ ] Multiple hosts leave/join rapidly - should handle gracefully

## Expected Behaviors

### Video Grid Layout
- 1 host: 1 column
- 2 hosts: 2 columns  
- 3-4 hosts: 2 columns
- 5+ hosts: 3 columns

### Host Status Indicators
- Green dot: Connected to LiveKit room
- Gray dot: In host list but not connected

### Notifications
- "Host Joined" when participant connects
- "Host Left" when participant disconnects
- "Reconnecting..." on connection loss
- "Reconnected" on connection restore

## API Behaviors

### POST /api/streams/[id]/hosts
- Returns existing host record if rejoining
- Creates new host record for first-time joins
- No longer enforces host limit

### POST /api/streams/[id]/leave
- Marks host as left (sets leftAt timestamp)
- Does NOT delete host record (allows rejoin)
- Only ends stream if owner leaves and no other hosts remain

### POST /api/invites/validate
- No host limit check
- Allows rejoining if user has existing host record
- Increments invite usage count