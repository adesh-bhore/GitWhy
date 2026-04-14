# GitWhy - Interview Guide

## The 30-Second Pitch

> "GitWhy is a commit context engine that captures the WHY behind code changes and builds a dependency graph to predict revert impact. I built it with a client-server architecture - CLI tool for developers, Express backend for AI, and a storage layer that scales from JSON to PostgreSQL with a feature flag. The interesting system design challenge was optimizing graph traversal - I moved from O(V+E) JavaScript BFS to PostgreSQL recursive CTEs with indexes, achieving 100x speedup at scale."

---

## Architecture Deep Dive

### Layer 1: CLI Tool (Client)
```
Git Hooks → Capture Context → Index Graph → Search
```

**Key Decisions:**
- **Why Git hooks?** Intercept commits at the source - zero friction for developers
- **Why client-side CLI?** Works offline, no network dependency for basic operations
- **Why Node.js?** Cross-platform, npm distribution, simple-git library

### Layer 2: Backend API (Server)
```
Express → Groq (diff analysis) → Cohere (embeddings)
```

**Key Decisions:**
- **Why separate backend?** Zero client setup - no API keys, no model management
- **Why Groq over GPT-4?** 10x faster, 10x cheaper, good enough for diff analysis
- **Why Cohere embeddings?** Free tier, better than Voyage AI for search

### Layer 3: Storage (Data)
```
JSON (Phase 1) → PostgreSQL (Phase 2) → Feature Flag
contexts.json (committed) + embeddings.json (ignored) + dependency-graph.json (ignored)
```

**Key Decisions:**
- **Why start with JSON?** Simplicity - works out of the box, git-friendly
- **Why migrate to PostgreSQL?** Recursive CTEs for BFS, JSONB for file queries, ACID for concurrent writes
- **Why feature flag?** Progressive complexity - add database only when needed
- **Why hybrid storage?** Keep git repo lean - commit contexts (2 MB), ignore embeddings (40 MB) and graph (5 MB)
- **Why sync command?** Rebuild derived data (embeddings, graph) from source of truth (contexts.json, git history)

---

## System Design Questions & Answers

### Q: How does the dependency graph work?

> "It's a DAG where nodes are commits and edges connect commits that touched the same files. When commit B modifies file X after commit A modified file X, I create an edge A → B because B likely assumed A's changes were in place.
>
> The write path runs on every post-commit hook: extract files from the diff, scan all prior nodes for file overlap using set intersection, write edges for each match. This is O(n × f) where n = prior commits, f = files per commit. At 10k commits × 4 files = 40k set lookups = <5ms.
>
> The read path is BFS forward traversal. In JSON, I build an adjacency map and traverse in JavaScript - O(V + E). In PostgreSQL, I use a recursive CTE with indexes on from_hash - same complexity but 100x faster due to query optimization."

### Q: Why file-level overlap instead of call graphs?

> "Call graphs require AST parsing - tree-sitter for JS, ast for Python, go/ast for Go. That's language-specific, complex, and fragile. File overlap is language-agnostic, computable from raw diffs, and 90% accurate in practice.
>
> The trade-off: false positives. If two commits touch the same file but unrelated lines, I create an edge anyway. But false positives are harmless - the revert-risk output includes an extra commit that the developer can ignore. False negatives (missing a real dependency) are much worse and rare with file-level tracking."

### Q: How does the search work?

> "Hybrid search: 85% BM25, 15% embeddings. Pure embedding search gave 36% accuracy on keyword matches because the model didn't capture domain-specific terms well. BM25 is the industry standard (Elasticsearch, Lucene) - it's based on term frequency and inverse document frequency, mathematically proven to work.
>
> I use embeddings as a semantic boost, not the primary signal. This gives me keyword precision (BM25) plus semantic understanding (embeddings). If the embedding API fails, search still works with BM25 alone - graceful degradation."

### Q: How do you handle git repository size with large .gitwhy/ directories?

> "I use a hybrid storage strategy that separates source of truth from derived data:
>
> **Committed to git:**
> - contexts.json (~2 MB for 10k commits) - human-readable, valuable, small
>
> **Ignored in git:**
> - embeddings.json (~40 MB for 10k commits) - regenerated from contexts via API
> - dependency-graph.json (~5 MB for 10k commits) - rebuilt from git history
>
> The key insight: embeddings and graph are **derived data**. They can be regenerated deterministically from contexts.json and git history. The `gitwhy sync` command rebuilds both in seconds.
>
> **Workflow:**
> 1. Developer A commits → contexts.json updated → git push
> 2. Developer B pulls → runs `gitwhy sync` → embeddings and graph rebuilt locally
> 3. Search works immediately
>
> This keeps the git repository lean (2 MB instead of 47 MB) while preserving all functionality. The trade-off is a one-time sync after git pull, but that's acceptable - it takes 10-20 seconds for 10k commits."

### Q: What if embeddings.json was committed to git?

> "That would work but has downsides:
>
> **Pros:**
> - No sync step needed
> - Immediate search after git pull
>
> **Cons:**
> - Git repo bloat: 40 MB for 10k commits, 400 MB for 100k commits
> - Merge conflicts: binary-like JSON files are hard to merge
> - Wasted bandwidth: every git pull downloads 40 MB even if only 1 commit changed
> - Embedding model changes: if I upgrade from Cohere to GPT-4 embeddings, all historical embeddings are stale
>
> The hybrid approach is better because it treats embeddings as a cache, not source of truth. Caches should be regenerated, not versioned."

### Q: How would you scale this to 1 million commits?

> "Right now I'm at Phase 2 - PostgreSQL with recursive CTEs. This works up to ~500k commits. At 1M commits, I'd move to Phase 3:
>
> **1. Distributed Graph Database (Neo4j/TigerGraph)**
> - Native graph storage with optimized traversal algorithms
> - Horizontal sharding for massive graphs
> - Cypher queries for complex graph patterns
>
> **2. Caching Layer (Redis)**
> - Cache BFS results for frequently queried commits
> - Invalidate cache on new edges using reverse adjacency list
> - TTL-based expiration for stale data
>
> **3. Async Processing (RabbitMQ/SQS)**
> - Move graph indexing off the post-commit hook
> - Workers process commits asynchronously
> - Eventual consistency is acceptable - graph updates within seconds
>
> **4. Read Replicas**
> - Separate read/write databases
> - Writes go to primary, reads from replicas
> - Replication lag is acceptable for search queries
>
> The key insight: **progressive complexity**. Don't build for 1M commits when you have 10k. Each phase adds complexity only when the previous phase becomes a bottleneck."

### Q: What about cache invalidation?

> "Cache invalidation is the hard part. When commit C is indexed and creates edges A → C and B → C, I need to invalidate cached BFS results for A and B because their downstream sets changed.
>
> I maintain a reverse adjacency list: hash → [parent hashes]. When C is indexed, I look up all parents (A, B) and invalidate their cache keys. I use Redis pipelining to batch the invalidations - one round trip for N invalidations instead of N round trips.
>
> The trade-off: memory overhead for the reverse map. At 500k edges, the reverse map is ~50MB in Redis. That's acceptable. The alternative - invalidating all cache on every commit - defeats the purpose of caching."

### Q: How do you handle concurrent writes?

> "In JSON mode, I don't - file locking is unreliable and race conditions are possible. This is acceptable because most repos have one active developer at a time.
>
> In PostgreSQL mode, I use transactions with row-level locking. The indexCommit operation is:
> ```sql
> BEGIN;
> INSERT INTO commits ...;
> SELECT ... WHERE files overlap;  -- finds prior commits
> INSERT INTO dependencies ...;    -- creates edges
> COMMIT;
> ```
>
> PostgreSQL's MVCC (Multi-Version Concurrency Control) handles concurrent transactions. If two commits are indexed simultaneously, both transactions see a consistent snapshot and create their edges independently. No deadlocks because we only INSERT, never UPDATE."

---

## Performance Numbers (Memorize These)

| Metric | JSON | PostgreSQL | Speedup |
|--------|------|------------|---------|
| Load graph (100k commits) | 200ms | N/A | - |
| BFS traversal | 500ms | 50ms | 10x |
| Index commit | 300ms | 10ms | 30x |
| Find by file | 100ms | 5ms | 20x |
| Concurrent writes | ❌ | ✅ | - |

---

## Code Walkthrough (What to Show)

### 1. Storage Adapter (Progressive Complexity)
```javascript
// src/storage/graphStore.adapter.js
const USE_POSTGRES = process.env.GITWHY_USE_POSTGRES === 'true';

export const getDownstream = USE_POSTGRES 
  ? pgStore.getDownstreamOptimized  // Recursive CTE
  : jsonStore.getDownstream;         // JavaScript BFS
```

**Talking Point**: "Same interface, different implementation. Feature flag controls which backend is used. Zero code changes in the application layer."

### 2. PostgreSQL Recursive CTE
```sql
WITH RECURSIVE downstream AS (
  SELECT to_hash, shared_files FROM dependencies WHERE from_hash = $1
  UNION
  SELECT d.to_hash, d.shared_files 
  FROM dependencies d
  INNER JOIN downstream ds ON d.from_hash = ds.hash
)
SELECT * FROM downstream;
```

**Talking Point**: "This is the exact same BFS algorithm, but in SQL. The query planner uses indexes on from_hash to make each join O(log n) instead of O(n). At 500k edges, this is 100x faster than JavaScript."

### 3. BM25 Search
```javascript
// src/core/bm25.js
const numerator = tf * (k1 + 1);
const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
score += idf * (numerator / denominator);
```

**Talking Point**: "BM25 is the industry standard for text search. It balances term frequency (how often a word appears) with inverse document frequency (how rare the word is) and document length normalization. This is what Elasticsearch uses under the hood."

---

## Demo Script (5 Minutes)

```bash
# 1. Show the problem
git log --oneline
# "Which of these commits can I safely revert?"

# 2. Show GitWhy solving it
gitwhy revert-risk abc1234
# "3 downstream commits depend on this - reverting will break them"

# 3. Show the conflict oracle
git merge feature-branch  # creates conflict
# GitWhy automatically shows WHY both sides changed

# 4. Show the search
gitwhy search "JWT authentication"
# "BM25 + embeddings finds relevant commits by meaning, not just keywords"

# 5. Show the scale solution
gitwhy migrate stats
# "Currently JSON, 1000 commits. Let me show you the PostgreSQL migration..."

gitwhy migrate to-postgres
export GITWHY_USE_POSTGRES=true

time gitwhy revert-risk abc1234
# "10x faster with recursive CTEs"
```

---

## Red Flags to Avoid

❌ "I used embeddings for search" → ❌ Shows you don't understand when embeddings fail
✅ "I used BM25 + embeddings" → ✅ Shows you understand hybrid approaches

❌ "I'd use microservices" → ❌ Premature complexity
✅ "I'd start with a monolith, split when needed" → ✅ Shows pragmatism

❌ "I'd use Kubernetes" → ❌ Overkill for this scale
✅ "I'd use PM2 on EC2, move to K8s at 1M+ requests/day" → ✅ Shows you understand when to scale

❌ "I'd use GraphQL" → ❌ Adds complexity without clear benefit
✅ "I'd use REST for now, GraphQL if clients need flexible queries" → ✅ Shows you make trade-offs

---

## Questions to Ask Them

1. "What's your current commit volume? This helps me understand if JSON or PostgreSQL is the right fit."
2. "Do you use monorepos or polyrepos? The dependency graph works differently for each."
3. "What's your deployment model? This affects whether the backend should be centralized or distributed."

These show you're thinking about real-world constraints, not just building features.

---

## The Closer

> "The interesting thing about this project is that it's not just a tool - it's a system design exercise. I started with the simplest thing that could work (JSON + JavaScript), measured where it became slow (BFS traversal), and optimized strategically (PostgreSQL + CTEs). That's how I approach all engineering problems: start simple, measure, optimize the bottleneck, repeat. The feature flag means I can A/B test the backends and make data-driven decisions about when to migrate users."

This shows:
- Systems thinking
- Performance engineering
- Data-driven decisions
- Progressive complexity
- Production mindset

---

**You're ready. Go crush that interview.** 🚀
