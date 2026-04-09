import fs from 'fs';
import path from 'path';


const getPath = () => path.join(process.cwd(), '.gitwhy', 'contexts.json');


/**
 * Load all context entries from disk.
 * Returns an empty array if the file doesn't exist or is malformed.
 */
export function loadContexts() {
  try {
    const raw = fs.readFileSync(getPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}


/**
 * Save a context entry.
 * Upserts by commitHash — if an entry for this hash already exists, it is replaced.
 * The 'embedding' field is stripped before saving to contexts.json
 * (embeddings are stored separately in embeddings.json).
 */
export function saveContext(entry) {
  const contexts = loadContexts();

  // Strip embedding from context store — kept in embeddingStore
  const { embedding, ...contextEntry } = entry;

  const existingIdx = contexts.findIndex(c => c.commitHash === contextEntry.commitHash);
  if (existingIdx >= 0) {
    contexts[existingIdx] = contextEntry;
  } else {
    contexts.push(contextEntry);
  }

  fs.writeFileSync(getPath(), JSON.stringify(contexts, null, 2) + '\n');
  return contextEntry;

}

/**
 * Update a provisional entry (created during prepare-commit-msg before the
 * real hash is known) with the actual commit hash.
 */
export function finalizeContext(provisionalKey, realHash) {
  const contexts = loadContexts();
  const idx = contexts.findIndex(c => c.commitHash === provisionalKey);
  if (idx >= 0) {
    contexts[idx].commitHash = realHash;
    contexts[idx].provisional = false;
    fs.writeFileSync(getPath(), JSON.stringify(contexts, null, 2) + '\n');
    return contexts[idx];
  }
  return null;
}


/**
 * Find a context entry by commit hash (supports short hashes).
 */
export function getContext(commitHash) {
  const contexts = loadContexts();
  return contexts.find(c =>
    c.commitHash === commitHash ||          // exact match
    c.commitHash.startsWith(commitHash)    // short hash
  ) || null;
}


/**
 * Delete a context entry by commit hash.
 */
export function deleteContext(commitHash) {
  const contexts = loadContexts().filter(c => c.commitHash !== commitHash);
  fs.writeFileSync(getPath(), JSON.stringify(contexts, null, 2) + '\n');
}

