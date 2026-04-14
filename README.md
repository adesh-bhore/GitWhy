# GitWhy - Intelligent Commit Context Engine

Capture the "WHY" behind every git commit with AI-powered context and semantic search.

## Quick Start

### Installation

```bash
npm install -g gitwhy
```

### Prerequisites

1. **Node.js** >= 18.0
2. **GCC** (for vector search engine) - Optional, only needed for semantic search
   - Linux/Mac: `sudo apt-get install build-essential` or `xcode-select --install`
   - Windows: Install via WSL or MinGW

That's it! No API keys, no Ollama installation required. GitWhy uses a hosted backend for AI and embeddings.

### Setup

**Initialize in your git repository:**
```bash
cd your-project
gitwhy init
git add .gitwhy/
git commit -m "Initialize GitWhy"
```

## Usage

### Capture Context (Automatic)

GitWhy automatically intercepts every commit via a Git hook:

```bash
git add file.js
git commit -m "fix authentication"
```

You'll be prompted:
- **What problem does this solve?**
- **What did you decide against?**

Or press Ctrl+C to let AI generate the context automatically.

### Skip Interactive Mode (AI Only)

To always use AI without prompts:

```bash
# One-time skip
GITWHY_SKIP=true git commit -m "your message"

# Always skip (add to your shell profile)
export GITWHY_SKIP=true
```

Or set in your repository's `.gitwhy/config.json`:
```json
{
  "autoEnrich": true
}
```

### Search Your Decision History

```bash
# Semantic search
gitwhy search "authentication changes"
gitwhy search "why did we refactor" --top 10

# View all entries
gitwhy log
gitwhy log --limit 50
gitwhy log --ai-only
gitwhy log --json
```

### Sync After Git Pull

After pulling changes from teammates:

```bash
git pull
gitwhy sync
```

This rebuilds embeddings and dependency graph from the committed contexts.json file.

### Dependency Analysis

GitWhy builds a commit dependency graph to help you understand impact:

```bash
# Check revert risk - what commits depend on this one?
gitwhy revert-risk abc123

# Automatic conflict context during merges
git merge feature-branch
# GitWhy automatically shows context from both sides of the conflict
```

The conflict oracle runs automatically during merge conflicts, showing you the "why" behind changes on both sides.

## Commands

### Setup
- `gitwhy init` - Initialize GitWhy in your repository
- `gitwhy migrate init-db` - Initialize PostgreSQL database (optional)
- `gitwhy migrate to-postgres` - Migrate from JSON to PostgreSQL (optional)
- `gitwhy migrate to-json` - Migrate from PostgreSQL to JSON (optional)

### Daily Usage
- `gitwhy search "query"` - Search commit context semantically
- `gitwhy log` - View all captured contexts
- `gitwhy sync` - Rebuild embeddings and graph after git pull

### Dependency Analysis
- `gitwhy revert-risk <hash>` - Check what depends on a commit
- `gitwhy conflict` - View context during merge conflicts (automatic)

### Maintenance
- `gitwhy rebuild` - Rebuild embeddings with improved context
- `gitwhy migrate stats` - View storage statistics

### Internal (called by Git hooks)
- `gitwhy capture` - Capture context during commit
- `gitwhy finalize` - Update provisional hash after commit
- `gitwhy graph-index` - Index commit into dependency graph

## Configuration

Optional environment variables:
- `GITWHY_API_URL` - Custom backend server URL (default: http://51.21.226.149:3000)
- `GITWHY_USE_POSTGRES` - Use PostgreSQL instead of JSON (default: false)
- `DATABASE_URL` - PostgreSQL connection string (only if using PostgreSQL)

### Default Setup (Zero Config)
```bash
npm install -g gitwhy-cli
gitwhy init
# Works immediately with JSON storage
```

### PostgreSQL Setup (Optional - for large repos)
```bash
# 1. Install PostgreSQL
brew install postgresql

# 2. Create database
createdb gitwhy

# 3. Configure
export DATABASE_URL="postgresql://localhost:5432/gitwhy"
export GITWHY_USE_POSTGRES=true

# 4. Initialize
gitwhy migrate init-db

# 5. Use GitWhy with PostgreSQL
gitwhy init
```

See [POSTGRES_SETUP.md](POSTGRES_SETUP.md) for details.

No API keys or local AI setup required!

## How It Works

1. **Git Hook** intercepts every commit
2. **Context Capture** asks two questions or uses AI (via hosted backend)
3. **Embeddings** generated via Voyage AI API (free tier)
4. **Vector Search** powered by compiled C engine (fast)
5. **Semantic Search** finds relevant commits by meaning, not keywords

All AI processing happens on a hosted backend - no local setup required!

## Team Usage

### Hybrid Storage Strategy

GitWhy uses a smart approach to keep your git repository lean:

- **contexts.json** (2 MB for 10k commits) - Committed to git, human-readable
- **embeddings.json** (40 MB for 10k commits) - Ignored, regenerated locally
- **dependency-graph.json** (5 MB for 10k commits) - Ignored, rebuilt from git history

This keeps your repository small while preserving all the important context.

### Workflow for Team Members

1. **Install GitWhy:**
   ```bash
   npm install -g gitwhy
   ```

2. **Clone the repository:**
   ```bash
   git clone your-repo
   cd your-repo
   ```

3. **Sync GitWhy data:**
   ```bash
   gitwhy sync
   ```
   This rebuilds embeddings and dependency graph from contexts.json and git history.

4. **After every git pull:**
   ```bash
   git pull
   gitwhy sync
   ```

That's it! No per-user configuration needed.

## Troubleshooting

**"C engine compilation failed"**
- Install GCC: `sudo apt-get install build-essential`
- Manually compile: `cd node_modules/gitwhy/engine && bash build.sh`
- Note: Vector search will fall back to JavaScript if C engine is unavailable

**"Server unavailable" errors**
- Check your internet connection
- Verify backend is accessible: `curl https://gitwhyserver-production.up.railway.app/health`
- Context is still saved locally even if AI fails

**Interactive prompts not working in Git hooks**
- This is automatically handled - GitWhy will fall back to AI if terminal is not interactive

**After git pull, search returns no results**
- Run `gitwhy sync` to rebuild embeddings and dependency graph
- This is needed because embeddings.json and dependency-graph.json are not committed to git

## Architecture

### Storage Strategy

GitWhy uses a hybrid approach to balance repository size with functionality:

| File | Size (10k commits) | Committed? | Purpose |
|------|-------------------|------------|---------|
| contexts.json | ~2 MB | ✅ Yes | Human-readable commit context |
| embeddings.json | ~40 MB | ❌ No | Vector embeddings for semantic search |
| dependency-graph.json | ~5 MB | ❌ No | Commit dependency DAG |

**Why this approach?**
- contexts.json is small, valuable, and human-readable - perfect for git
- embeddings.json and dependency-graph.json are large but can be regenerated
- Keeps git repository lean while preserving all important data
- `gitwhy sync` rebuilds derived data in seconds

### Backend Architecture

- **Client**: CLI tool (this package)
- **Server**: Express backend on EC2 (http://51.21.226.149:3000)
- **AI**: Groq (llama-3.1-8b-instant) for diff analysis
- **Embeddings**: Cohere (primary), Voyage AI (fallback)
- **Search**: BM25 (85%) + embeddings (15%) hybrid

Zero client configuration - all API keys on server side.

## License

MIT
