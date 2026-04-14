import simpleGit from 'simple-git';
import { loadGraph, saveGraph, indexCommit as indexCommitAdapter, getDownstream as getDownstreamAdapter } from '../storage/graphStore.adapter.js';



/**
 * Called by the post-commit hook after every commit.
 * Adds a node for the new commit and edges to all prior
 * commits that share at least one modified file.
 */

export async function indexCommit(commitHash) {
    const git = simpleGit();

    // Get the list of files changed in this commit
    const diffOutput = await git.show([
        '--name-only',
        '--format=',          // suppress commit metadata
        commitHash
    ]);

    const files = diffOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .filter(f => !f.startsWith('diff'));   // git show includes diff headers

    if (files.length === 0) return;         // empty commit — nothing to index

    const timestamp = new Date().toISOString();
    
    // Use the adapter which handles both JSON and PostgreSQL
    await indexCommitAdapter(commitHash, files, timestamp);
}


// write side 

/**
 * Returns all commits that transitively depend on the target commit.
 * "Depend on" means: touched the same files after the target commit did.
 *
 * Uses BFS over the forward edge list.
 *
 * @param {string} targetHash  - the commit you want to revert
 * @returns {string[]}         - array of dependent commit hashes, BFS order
 */

export async function getDownstream(targetHash) {
    // Use the adapter which handles both JSON BFS and PostgreSQL CTE
    return getDownstreamAdapter(targetHash);
}