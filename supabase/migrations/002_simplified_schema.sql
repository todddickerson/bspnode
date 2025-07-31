-- Simplified schema for quick setup
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create stream_stats table
CREATE TABLE IF NOT EXISTS stream_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL UNIQUE,
  viewer_count INTEGER DEFAULT 0,
  heart_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create stream_presence table
CREATE TABLE IF NOT EXISTS stream_presence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(stream_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_stream_id ON messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_presence_stream_id ON stream_presence(stream_id);

-- Basic RLS policies (disable RLS for now for easier testing)
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE stream_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE stream_presence DISABLE ROW LEVEL SECURITY;