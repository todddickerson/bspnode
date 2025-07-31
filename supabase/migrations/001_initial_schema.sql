-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create messages table for real-time chat
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create stream_stats table for viewer counts and reactions
CREATE TABLE stream_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL UNIQUE,
  viewer_count INTEGER DEFAULT 0,
  heart_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create stream_presence table for tracking active viewers
CREATE TABLE stream_presence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(stream_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_messages_stream_id ON messages(stream_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_stream_presence_stream_id ON stream_presence(stream_id);
CREATE INDEX idx_stream_presence_last_seen ON stream_presence(last_seen);

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
-- Anyone can read messages for a stream
CREATE POLICY "Messages are viewable by everyone" ON messages
  FOR SELECT USING (true);

-- Only authenticated users can insert messages
CREATE POLICY "Authenticated users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for stream_stats
-- Anyone can read stream stats
CREATE POLICY "Stream stats are viewable by everyone" ON stream_stats
  FOR SELECT USING (true);

-- Only system can update stream stats (we'll use service role key)
CREATE POLICY "Only system can update stream stats" ON stream_stats
  FOR ALL USING (false);

-- RLS Policies for stream_presence
-- Anyone can read presence
CREATE POLICY "Stream presence is viewable by everyone" ON stream_presence
  FOR SELECT USING (true);

-- Authenticated users can manage their own presence
CREATE POLICY "Users can manage their own presence" ON stream_presence
  FOR ALL USING (auth.uid()::text = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_stats_updated_at BEFORE UPDATE ON stream_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old presence records (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM stream_presence 
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ language 'plpgsql';

-- Function to calculate viewer count excluding hosts
CREATE OR REPLACE FUNCTION calculate_viewer_count(p_stream_id TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN COUNT(*) FROM stream_presence 
  WHERE stream_id = p_stream_id 
  AND is_host = false 
  AND last_seen > NOW() - INTERVAL '30 seconds';
END;
$$ language 'plpgsql';