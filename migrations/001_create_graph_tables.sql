-- GitWhy Dependency Graph Schema
-- Migration 001: Initial graph tables

-- Commits table (nodes in the graph)
CREATE TABLE IF NOT EXISTS commits (
  hash VARCHAR(40) PRIMARY KEY,
  files JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dependencies table (edges in the graph)
CREATE TABLE IF NOT EXISTS dependencies (
  id SERIAL PRIMARY KEY,
  from_hash VARCHAR(40) NOT NULL REFERENCES commits(hash) ON DELETE CASCADE,
  to_hash VARCHAR(40) NOT NULL REFERENCES commits(hash) ON DELETE CASCADE,
  shared_files JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_hash, to_hash)
);

-- Indexes for fast BFS traversal
CREATE INDEX IF NOT EXISTS idx_deps_from ON dependencies(from_hash);
CREATE INDEX IF NOT EXISTS idx_deps_to ON dependencies(to_hash);

-- GIN index for file search (JSONB array contains operator)
CREATE INDEX IF NOT EXISTS idx_commits_files ON commits USING GIN(files);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);

-- Contexts table (optional - can keep in JSON or move here)
CREATE TABLE IF NOT EXISTS contexts (
  commit_hash VARCHAR(40) PRIMARY KEY REFERENCES commits(hash) ON DELETE CASCADE,
  problem TEXT NOT NULL,
  alternatives TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Embeddings table (optional - for future vector search)
CREATE TABLE IF NOT EXISTS embeddings (
  commit_hash VARCHAR(40) PRIMARY KEY REFERENCES commits(hash) ON DELETE CASCADE,
  vector JSONB NOT NULL,  -- Store as JSONB for now, can migrate to pgvector later
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES (1)
ON CONFLICT (version) DO NOTHING;
