import fs   from 'fs';
import path from 'path';

const getPath = () => path.join(process.cwd(), '.gitwhy', 'dependency-graph.json');

const EMPTY_GRAPH = { nodes: [], edges: [] };


/**
 * Load the full dependency graph from disk.
 * Returns an empty graph if the file does not exist or is malformed.
 */
export function loadGraph() {
  try {
    const raw = fs.readFileSync(getPath(), 'utf8');
    const parsed = JSON.parse(raw);
    // Validate shape — both arrays must exist
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return { ...EMPTY_GRAPH };
    }
    return parsed;
  } catch {
    return { ...EMPTY_GRAPH };
  }
}


/**
 * Write the full graph back to disk.
 * Atomic write via temp file + rename to avoid partial writes
 * if the process is killed mid-write.
 */
export function saveGraph(graph) {
  const target  = getPath();
  const tmp     = target + '.tmp';
  const content = JSON.stringify(graph, null, 2) + '\n';

  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, target);   // atomic on POSIX systems
}



/**
 * Build an in-memory adjacency map for fast BFS traversal.
 * Returns Map<fromHash, [{hash, sharedFiles}]>
 */
export function buildForwardMap(graph) {
  const map = new Map();
  for (const edge of graph.edges) {
    if (!map.has(edge.from)) map.set(edge.from, []);
    map.get(edge.from).push({ hash: edge.to, sharedFiles: edge.sharedFiles });
  }
  return map;
}


/**
 * Returns all node hashes that touch a given file.
 * Used by the conflict oracle to find which commits
 * touched a conflicting file on each branch.
 */
export function getNodesByFile(graph, filePath) {
  return graph.nodes
    .filter(n => n.files.includes(filePath))
    .map(n => n.hash);
}

