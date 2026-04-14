/**
 * Storage adapter with feature flag
 * Switches between JSON and PostgreSQL based on environment variable
 */

import * as jsonStore from './graphStore.js';
import * as pgStore from './graphStore.postgres.js';

const USE_POSTGRES = process.env.GITWHY_USE_POSTGRES === 'true';

// Export the appropriate implementation based on feature flag
export const loadGraph = USE_POSTGRES ? pgStore.loadGraph : jsonStore.loadGraph;
export const saveGraph = USE_POSTGRES ? pgStore.saveGraph : jsonStore.saveGraph;
export const buildForwardMap = USE_POSTGRES ? pgStore.buildForwardMap : jsonStore.buildForwardMap;
export const getNodesByFile = USE_POSTGRES ? pgStore.getNodesByFile : jsonStore.getNodesByFile;

/**
 * Index a commit - uses optimized PostgreSQL version if available
 */
export async function indexCommit(commitHash, files, timestamp) {
  if (USE_POSTGRES) {
    return pgStore.indexCommitOptimized(commitHash, files, timestamp);
  } else {
    // Use the existing JSON implementation
    const graph = await jsonStore.loadGraph();
    
    const newNode = {
      hash: commitHash,
      files,
      timestamp: timestamp || new Date().toISOString()
    };
    
    const fileSet = new Set(files);
    
    for (const node of graph.nodes) {
      const sharedFiles = node.files.filter(f => fileSet.has(f));
      if (sharedFiles.length > 0) {
        graph.edges.push({
          from: node.hash,
          to: commitHash,
          sharedFiles,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    graph.nodes.push(newNode);
    jsonStore.saveGraph(graph);
  }
}

/**
 * Get downstream commits - uses optimized PostgreSQL CTE if available
 */
export async function getDownstream(targetHash) {
  if (USE_POSTGRES) {
    return pgStore.getDownstreamOptimized(targetHash);
  } else {
    // Use existing JSON BFS implementation
    const graph = await jsonStore.loadGraph();
    
    const forward = new Map();
    for (const edge of graph.edges) {
      if (!forward.has(edge.from)) forward.set(edge.from, []);
      forward.get(edge.from).push({ hash: edge.to, sharedFiles: edge.sharedFiles });
    }
    
    const visited = new Set();
    const queue = [targetHash];
    const result = [];
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      
      const children = forward.get(current) || [];
      for (const child of children) {
        if (!visited.has(child.hash)) {
          result.push({ hash: child.hash, via: child.sharedFiles });
          queue.push(child.hash);
        }
      }
    }
    
    return result;
  }
}

/**
 * Get storage backend info
 */
export function getStorageInfo() {
  return {
    backend: USE_POSTGRES ? 'PostgreSQL' : 'JSON',
    optimized: USE_POSTGRES,
    envVar: 'GITWHY_USE_POSTGRES',
    currentValue: process.env.GITWHY_USE_POSTGRES
  };
}

/**
 * Get graph statistics (works for both backends)
 */
export async function getGraphStats() {
  if (USE_POSTGRES) {
    return pgStore.getGraphStats();
  } else {
    const graph = await jsonStore.loadGraph();
    return {
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      avg_files_per_commit: graph.nodes.length > 0 
        ? graph.nodes.reduce((sum, n) => sum + n.files.length, 0) / graph.nodes.length 
        : 0,
      backend: 'JSON'
    };
  }
}
