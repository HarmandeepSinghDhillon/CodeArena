-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    progress TEXT DEFAULT '{}'::text NOT NULL,
    status TEXT DEFAULT 'ACTIVE'::text NOT NULL,
    avatar_url TEXT
);

-- Create problems table
CREATE TABLE IF NOT EXISTS problems (
    id BIGINT PRIMARY KEY,
    json_data TEXT NOT NULL
);
