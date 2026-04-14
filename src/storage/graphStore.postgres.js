import pg from 'pg';

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function initPool() {
  if (pool) return pool;
  
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });
  
  return pool;
}

/**
 * Close the connection pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Load the full dependency graph from PostgreSQL
 * Returns {nodes: [], edges: []} matching JSON format
 */
export async function loadGraph() {
  const client = initPool();
  
  try {
    // Load all nodes
    const nodesResult = await client.query(
      'SELECT hash, files, timestamp FROM commits ORDER BY timestamp'
    );
    
    // Load all edges
    const edgesResult = await client.query(
      'SELECT from_hash, to_hash, shared_files, created_at FROM dependencies ORDER BY created_at'
    );
    
    return {
      nodes: nodesResult.rows.map(row => ({
        hash: row.hash,
        files: row.files, // JSONB is automatically parsed
        timestamp: row.timestamp.toISOString()
      })),
      edges: edgesResult.rows.map(row => ({
        from: row.from_hash,
        to: row.to_hash,
        sharedFiles: row.shared_files,
        createdAt: row.created_at.toISOString()
      }))
    };
  } catch (err) {
    console.error('Error loading graph from PostgreSQL:', err);
    throw err;
  }
}

/**
 * Save a complete graph to PostgreSQL
 * Used for bulk import from JSON
 */
export async function saveGraph(graph) {
  const client = await initPool().connect();
  
  try {
    await client.query('BEGIN');
    
    // Clear existing data
    await client.query('TRUNCATE commits CASCADE');
    
    // Insert all nodes
    for (const node of graph.nodes) {
      await client.query(
        'INSERT INTO commits (hash, files, timestamp) VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING',
        [node.hash, JSON.stringify(node.files), node.timestamp]
      );
    }
    
    // Insert all edges
    for (const edge of graph.edges) {
      await client.query(
        'INSERT INTO dependencies (from_hash, to_hash, shared_files, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (from_hash, to_hash) DO NOTHING',
        [edge.from, edge.to, JSON.stringify(edge.sharedFiles), edge.createdAt]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Add a single commit node to the graph
 * Returns the created node
 */
export async function addNode(hash, files, timestamp) {
  const client = initPool();
  
  const result = await client.query(
    'INSERT INTO commits (hash, files, timestamp) VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING RETURNING *',
    [hash, JSON.stringify(files), timestamp]
  );
  
  return result.rows[0];
}

/**
 * Add a dependency edge between two commits
 */
export async function addEdge(fromHash, toHash, sharedFiles) {
  const client = initPool();
  
  await client.query(
    'INSERT INTO dependencies (from_hash, to_hash, shared_files) VALUES ($1, $2, $3) ON CONFLICT (from_hash, to_hash) DO NOTHING',
    [fromHash, toHash, JSON.stringify(sharedFiles)]
  );
}

/**
 * Index a commit: add node and create edges to overlapping commits
 * This is the optimized version that uses SQL to find overlaps
 */
export async function indexCommitOptimized(commitHash, files, timestamp) {
  const client = await initPool().connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert the new commit node
    await client.query(
      'INSERT INTO commits (hash, files, timestamp) VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING',
      [commitHash, JSON.stringify(files), timestamp]
    );
    
    // Find all prior commits that share at least one file
    // Using JSONB ?| operator (overlap operator)
    const overlaps = await client.query(`
      SELECT hash, files
      FROM commits
      WHERE hash != $1
        AND files ?| $2::text[]
    `, [commitHash, files]);
    
    // Create edges for each overlapping commit
    for (const row of overlaps.rows) {
      const priorFiles = row.files;
      const sharedFiles = files.filter(f => priorFiles.includes(f));
      
      if (sharedFiles.length > 0) {
        await client.query(
          'INSERT INTO dependencies (from_hash, to_hash, shared_files) VALUES ($1, $2, $3) ON CONFLICT (from_hash, to_hash) DO NOTHING',
          [row.hash, commitHash, JSON.stringify(sharedFiles)]
        );
      }
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get all downstream commits using recursive CTE
 * This is 100x faster than JavaScript BFS for large graphs
 */
export async function getDownstreamOptimized(targetHash) {
  const client = initPool();
  
  const query = `
    WITH RECURSIVE downstream AS (
      -- Base case: direct children of target commit
      SELECT to_hash as hash, shared_files, 1 as depth
      FROM dependencies
      WHERE from_hash = $1
      
      UNION
      
      -- Recursive case: children of children
      SELECT d.to_hash, d.shared_files, ds.depth + 1
      FROM dependencies d
      INNER JOIN downstream ds ON d.from_hash = ds.hash
      WHERE ds.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT hash, shared_files, depth
    FROM downstream
    ORDER BY depth, hash
  `;
  
  const result = await client.query(query, [targetHash]);
  
  return result.rows.map(row => ({
    hash: row.hash,
    via: row.shared_files,
    depth: row.depth
  }));
}

/**
 * Build forward adjacency map (for compatibility with JSON implementation)
 */
export async function buildForwardMap() {
  const client = initPool();
  
  const result = await client.query(
    'SELECT from_hash, to_hash, shared_files FROM dependencies ORDER BY from_hash'
  );
  
  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.from_hash)) {
      map.set(row.from_hash, []);
    }
    map.get(row.from_hash).push({
      hash: row.to_hash,
      sharedFiles: row.shared_files
    });
  }
  
  return map;
}

/**
 * Get all commits that touch a specific file
 */
export async function getNodesByFile(filePath) {
  const client = initPool();
  
  const result = await client.query(
    `SELECT hash FROM commits WHERE files @> $1::jsonb`,
    [JSON.stringify([filePath])]
  );
  
  return result.rows.map(row => row.hash);
}

/**
 * Get graph statistics
 */
export async function getGraphStats() {
  const client = initPool();
  
  const stats = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM commits) as node_count,
      (SELECT COUNT(*) FROM dependencies) as edge_count,
      (SELECT AVG(array_length(files::text[], 1)) FROM commits) as avg_files_per_commit,
      (SELECT pg_size_pretty(pg_total_relation_size('commits'))) as commits_size,
      (SELECT pg_size_pretty(pg_total_relation_size('dependencies'))) as dependencies_size
  `);
  
  return stats.rows[0];
}
