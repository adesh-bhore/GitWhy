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

## Configuration

Optional environment variable:
- `GITWHY_API_URL` - Custom backend server URL (default: https://gitwhyserver-production.up.railway.app)

No API keys or local AI setup required!

## How It Works

1. **Git Hook** intercepts every commit
2. **Context Capture** asks two questions or uses AI (via hosted backend)
3. **Embeddings** generated via Voyage AI API (free tier)
4. **Vector Search** powered by compiled C engine (fast)
5. **Semantic Search** finds relevant commits by meaning, not keywords

All AI processing happens on a hosted backend - no local setup required!

## Team Usage

Each team member:
1. Installs GitWhy: `npm install -g gitwhy`
2. Runs `gitwhy init` in the shared repository

The `.gitwhy/` directory (contexts and embeddings) is committed and shared via git.

No per-user configuration needed!

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

## License

MIT
