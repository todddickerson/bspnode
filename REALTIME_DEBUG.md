# Supabase Real-time Debugging Guide

## Current Status

✅ **Database Connection**: Working  
✅ **Message Insert/Read**: Working  
✅ **Environment Variables**: Correctly configured  
❌ **Real-time Subscription**: Not receiving updates  

## Issue Summary

The real-time subscription connects (`SUBSCRIBED`) but immediately closes (`CLOSED`). Messages are stored and can be queried, but real-time updates aren't received.

## Debugging Steps Taken

1. **Verified Environment Variables**
   - `SUPABASE_URL`: ✅ Valid format
   - `SUPABASE_ANON_PUBLIC`: ✅ Present (208 chars)
   - WebSocket URL derived correctly

2. **Database Operations**
   - Insert messages: ✅ Working
   - Query messages: ✅ Working
   - Tables have RLS disabled: ✅ Confirmed

3. **Real-time Subscription**
   - Client connects: ✅
   - Status changes to SUBSCRIBED: ✅
   - Immediately changes to CLOSED: ❌

## Root Cause

The issue is likely that **real-time is not enabled on the messages table** in the Supabase dashboard.

## Solution

### Step 1: Enable Real-time in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `pdgqkfmghtvfubffzctq`
3. Navigate to **Database → Replication**
4. Find the `messages` table
5. Toggle **Enable Realtime** to ON
6. Also enable for `stream_stats` and `stream_presence` tables

### Step 2: Run the Real-time Enable SQL

If the dashboard method doesn't work, run this SQL in the SQL Editor:

```sql
-- Enable real-time extension
CREATE EXTENSION IF NOT EXISTS "supabase_realtime";

-- Add tables to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_presence;

-- Verify it's enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

### Step 3: Test Real-time

After enabling real-time:

1. Open http://localhost:3001/debug in your browser
2. Open the browser console (F12)
3. Look for these logs:
   - `🔌 Setting up real-time subscription`
   - `✅ Successfully subscribed to real-time updates`
4. Send a test message using the debug page
5. Check if you see `📨 Real-time message received`

### Step 4: Alternative - Use Broadcast Instead

If database real-time doesn't work, we can use Supabase's broadcast feature as a fallback:

```typescript
// Instead of postgres_changes
channel
  .on('broadcast', { event: 'new-message' }, (payload) => {
    console.log('New message via broadcast:', payload)
  })
  .subscribe()
```

## Console Logs to Check

When debugging, look for these logs in the browser console:

```
🔄 useSupabaseChat: Starting effect
📥 Loading initial messages for stream
🔌 Setting up real-time subscription
🔌 Subscription status changed: SUBSCRIBED
✅ Successfully subscribed to real-time updates
📨 Real-time message received: {...}
```

## Common Issues

1. **Real-time not enabled**: Most common issue - needs to be enabled per table
2. **RLS blocking real-time**: We've disabled RLS, so this isn't the issue
3. **Network/firewall**: WebSocket connections might be blocked
4. **Supabase plan limits**: Free tier has real-time limits

## Next Steps

1. Enable real-time in Supabase dashboard
2. Test with the debug page
3. Check browser console for detailed logs
4. If still not working, consider using Socket.io as fallback