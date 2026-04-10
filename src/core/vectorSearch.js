import { spawn }     from 'child_process';
import { readFile }  from 'fs/promises';
import path          from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE    = path.join(__dirname, '../../engine/search');
const ENGINE_EXE = path.join(__dirname, '../../engine/search.exe');
const DIMS      = parseInt(process.env.GITWHY_DIMS || '768');


/**
 * JavaScript fallback for cosine similarity calculation
 */
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * JavaScript fallback search when C engine is not available
 */
async function jsVectorSearch(queryVec, embeddingsPath, topK = 5) {
    const raw = await readFile(embeddingsPath, 'utf8');
    const stored = JSON.parse(raw);
    
    const results = stored.map(entry => ({
        commitHash: entry.commitHash,
        score: cosineSimilarity(queryVec, entry.vector)
    }));
    
    // Sort by score descending and take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}




/**
 * Serialize a float array as space-separated values terminated by a newline.
 * This is the stdin protocol the C engine expects — one vector per line.
 */
function serializeVector(vec) {
    return vec.join(' ') + '\n';
}



/**
 * Run the C vector search engine as a child process.
 *
 * Protocol:
 *   stdin  line 1:   query vector (space-separated floats)
 *   stdin  lines 2+: stored document vectors (one per line)
 *   stdout:          "index score\n" pairs, one per result, sorted descending
 *
 * Vectors never enter the V8 heap — they flow from JSON through stdin
 * into C stack memory, are processed natively, and only the tiny
 * result list (index + score pairs) returns to Node.
 * @param {number[]} queryVec       - 768-dim query embedding
 * @param {string}   embeddingsPath - path to .gitwhy/embeddings.json
 * @param {number}   topK           - number of results to return
 * @returns {Promise<{commitHash: string, score: number}[]>}
 */


export async function vectorSearch(queryVec, embeddingsPath, topK = 5) {
    // Check if C engine exists, otherwise use JavaScript fallback
    const enginePath = process.platform === 'win32' ? ENGINE_EXE : ENGINE;
    
    if (!fs.existsSync(enginePath)) {
        console.warn('C search engine not found, using JavaScript fallback (slower)');
        return jsVectorSearch(queryVec, embeddingsPath, topK);
    }

    const raw    = await readFile(embeddingsPath, 'utf8');
    const stored = JSON.parse(raw);           // [{commitHash, vector}]
    const hashes = stored.map(e => e.commitHash);

    return new Promise((resolve, reject) => {
        const child = spawn(enginePath, [String(topK), String(DIMS)]);

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });

        child.on('close', code => {
            if (code !== 0) {
                return reject(new Error(`search engine exited ${code}: ${stderr}`));
            }

            const results = stdout.trim().split('\n')
                .filter(Boolean)
                .map(line => {
                    const [idx, score] = line.split(' ');
                    return {
                        commitHash: hashes[parseInt(idx)],
                        score:      parseFloat(score)
                    };
                });

            resolve(results);
        });

        child.on('error', err => {
            // Fallback to JavaScript if spawn fails
            console.warn('C engine spawn failed, using JavaScript fallback');
            resolve(jsVectorSearch(queryVec, embeddingsPath, topK));
        });

        /* Write query vector first, then all stored vectors */
        child.stdin.write(serializeVector(queryVec));
        for (const entry of stored) {
            child.stdin.write(serializeVector(entry.vector));
        }
        child.stdin.end();
    });
}
