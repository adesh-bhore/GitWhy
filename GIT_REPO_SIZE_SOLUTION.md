# Git Repository Size Management - Solution

## Problem
With 10k commits, the `.gitwhy/` directory grows to ~47 MB:
- contexts.json: 2 MB
- embeddings.json: 40 MB
- dependency-graph.json: 5 MB

Committing all of this to git causes repository bloat.

## Solution: Hybrid Storage Strategy

### What Gets Committed
✅ **contexts.json** (2 MB)
- Human-readable commit context
- Source of truth for all decisions
- Small and valuable

### What Gets Ignored
❌ **embeddings.json** (40 MB)
- Vector embeddings for semantic search
- Derived data - can be regenerated from contexts.json via API
- Large and binary-like

❌ **dependency-graph.json** (5 MB)
- Commit dependency DAG
- Derived data - can be rebuilt from git history
- Regenerated in seconds

## Implementation

### 1. Updated .gitignore
```gitignore
# GitWhy specific
.gitwhy/.pending
.gitwhy/embeddings.json       # Large file - regenerate with 'gitwhy rebuild'
.gitwhy/dependency-graph.json # Large file - regenerate from git history

# Keep contexts.json committed (small, human-readable, useful)
```

### 2. Created `gitwhy sync` Command
**File:** `src/commands/sync.js`

**What it does:**
1. Reads contexts.json (committed)
2. Rebuilds embeddings.json by calling the embedding API
3. Rebuilds dependency-graph.json by scanning git history
4. Takes 10-20 seconds for 10k commits

**Usage:**
```bash
git pull
gitwhy sync
```

### 3. Updated Documentation
- README.md: Added team workflow section
- INTERVIEW_GUIDE.md: Added Q&A about git repo size management

## Team Workflow

### Developer A (makes changes)
```bash
git add file.js
git commit -m "fix auth"
# GitWhy captures context → updates contexts.json
git push
```

### Developer B (pulls changes)
```bash
git pull
# Only contexts.json is pulled (2 MB, not 47 MB)
gitwhy sync
# Rebuilds embeddings.json and dependency-graph.json locally
gitwhy search "auth changes"
# Search works immediately
```

## Benefits

1. **Lean Git Repository**
   - 2 MB instead of 47 MB for 10k commits
   - 95% size reduction

2. **No Merge Conflicts**
   - embeddings.json and dependency-graph.json are binary-like
   - Ignoring them prevents merge conflicts

3. **Bandwidth Savings**
   - git pull only downloads 2 MB instead of 47 MB
   - 95% bandwidth reduction

4. **Model Flexibility**
   - If embedding model changes (Cohere → GPT-4), just run `gitwhy sync`
   - No need to rewrite git history

5. **Deterministic Rebuilds**
   - Embeddings and graph are derived data
   - Can be regenerated anytime from source of truth

## Trade-offs

### Pros
- Lean git repository
- No merge conflicts
- Bandwidth savings
- Model flexibility

### Cons
- One-time sync step after git pull (10-20 seconds)
- Requires API access to rebuild embeddings
- Slightly more complex workflow

## Alternative Solutions Considered

### 1. Git LFS
- Store large files outside git history
- Requires Git LFS setup on all machines
- More complex than hybrid approach

### 2. PostgreSQL Only
- Don't commit .gitwhy/ at all
- Requires shared database setup
- Overkill for most teams

### 3. Commit Everything
- Simple workflow
- 47 MB repository bloat
- Merge conflicts on binary files
- Wasted bandwidth

## Conclusion

The hybrid storage strategy is the best balance between simplicity and efficiency. It keeps the git repository lean while preserving all functionality. The one-time sync step is acceptable for the benefits gained.
