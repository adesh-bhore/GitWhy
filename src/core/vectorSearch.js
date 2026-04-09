import { spawn }     from 'child_process';
import { readFile }  from 'fs/promises';
import path          from 'path';
import { fileURLToPath } from 'url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE    = path.join(__dirname, '../../engine/search');
const DIMS      = parseInt(process.env.GITWHY_DIMS || '768');




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
    const raw    = await readFile(embeddingsPath, 'utf8');
    const stored = JSON.parse(raw);           // [{commitHash, vector}]
    const hashes = stored.map(e => e.commitHash);

    return new Promise((resolve, reject) => {
        const child = spawn(ENGINE, [String(topK), String(DIMS)]);

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
            reject(new Error(`failed to spawn search engine: ${err.message} — did you run 'npm run build:engine'?`));
        });

        /* Write query vector first, then all stored vectors */
        child.stdin.write(serializeVector(queryVec));
        for (const entry of stored) {
            child.stdin.write(serializeVector(entry.vector));
        }
        child.stdin.end();
    });
}
