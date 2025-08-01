-- Enable real-time for tables
-- Run this in Supabase SQL Editor after running 002_simplified_schema.sql

-- First, check if realtime extension is enabled
CREATE EXTENSION IF NOT EXISTS "supabase_realtime";

-- Enable real-time on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable real-time on the stream_stats table  
ALTER PUBLICATION supabase_realtime ADD TABLE stream_stats;

-- Enable real-time on the stream_presence table
ALTER PUBLICATION supabase_realtime ADD TABLE stream_presence;

-- Verify real-time is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Grant necessary permissions for anon users (for testing)
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;