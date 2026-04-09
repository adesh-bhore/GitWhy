import fs from 'fs';
import path from 'path';

const getPath = () => path.join(process.cwd(), '.gitwhy', 'embeddings.json');

export function loadEmbeddings() {
  try {
    return JSON.parse(fs.readFileSync(getPath(), 'utf8'));
  } catch {
    return [];
  }
}

export function saveEmbedding(commitHash, vector) {
  const embeddings = loadEmbeddings();
  const existingIdx = embeddings.findIndex(e => e.commitHash === commitHash);

  const entry = { commitHash, vector, savedAt: new Date().toISOString() };

  if (existingIdx >= 0) {
    embeddings[existingIdx] = entry;
  } else {
    embeddings.push(entry);
  }

  fs.writeFileSync(getPath(), JSON.stringify(embeddings, null, 2) + '\n');
}

export function finalizeEmbedding(provisionalKey, realHash) {
  const embeddings = loadEmbeddings();
  const idx = embeddings.findIndex(e => e.commitHash === provisionalKey);
  if (idx >= 0) {
    embeddings[idx].commitHash = realHash;
    fs.writeFileSync(getPath(), JSON.stringify(embeddings, null, 2) + '\n');
  }
}

export function getEmbedding(commitHash) {
  return loadEmbeddings().find(e =>
    e.commitHash === commitHash ||
    e.commitHash.startsWith(commitHash)
  ) || null;
}