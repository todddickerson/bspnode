# Supabase Migration Guide

This guide explains how to set up and use Supabase for real-time features in BSPNode.

## Prerequisites

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and API keys from the project settings

## Database Setup

1. Run the SQL migration in the Supabase SQL Editor:
   ```sql
   -- Copy contents from supabase/migrations/001_initial_schema.sql
   ```

2. This creates the following tables:
   - `messages` - Real-time chat messages
   - `stream_stats` - Viewer counts and heart reactions
   - `stream_presence` - Active viewer tracking

## Environment Variables

Add these to your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Features Migrated

### 1. Real-time Chat
- Messages persist to database
- Real-time updates via Supabase subscriptions
- Message history loads automatically

### 2. Viewer Presence
- Track active viewers per stream
- Exclude hosts from viewer count
- Automatic cleanup of inactive users

### 3. Stream Statistics
- Heart reaction counts
- Viewer statistics
- Real-time updates

## Usage

### For Viewers
```tsx
import { StreamViewerSupabase } from '@/components/stream-viewer-supabase'
import { ChatSupabase } from '@/components/chat-supabase'

// Use these components instead of the Socket.io versions
```

### For Studio (Hosts)
The studio page still needs to be migrated to use Supabase hooks.

## Benefits Over Socket.io

1. **Built-in Persistence**: All data is automatically stored
2. **Row-Level Security**: Fine-grained access control
3. **No Server Management**: Supabase handles the infrastructure
4. **Better Scalability**: Handles millions of concurrent connections
5. **Offline Support**: Built-in offline capabilities

## Migration Status

- ✅ Chat component migrated
- ✅ Viewer page migrated
- ✅ Database schema created
- ✅ Real-time hooks implemented
- ⏳ Studio page migration pending
- ⏳ Socket.io removal pending

## Next Steps

1. Test the Supabase implementation
2. Migrate studio page to use Supabase
3. Remove Socket.io dependencies
4. Update deployment configuration