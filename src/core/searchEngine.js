import path          from 'path';
import { readFile }  from 'fs/promises';
import { generateEmbedding } from '../ai/embeddings.js';
import { vectorSearch }      from './vectorSearch.js';


const EMBEDDINGS_PATH = path.join(process.cwd(), '.gitwhy', 'embeddings.json');
const CONTEXTS_PATH   = path.join(process.cwd(), '.gitwhy', 'contexts.json');



/**
 * Main search function.
 *
 * 1. Embeds the query via Ollama nomic-embed-text (input_type='query')
 * 2. Spawns the C engine to compute cosine similarity over all stored vectors
 * 3. Hydrates the top-K index results with context metadata
 *
 * @param {string} query    - Natural language search query
 * @param {number} topK     - Number of results to return
 * @param {number} minScore - Minimum cosine similarity threshold (0-1)
 */


export async function semanticSearch(query, topK = 5, minScore = 0.1) {
    const raw      = await readFile(CONTEXTS_PATH, 'utf8').catch(() => '[]');
    const contexts = JSON.parse(raw);

    if (contexts.length === 0) {
        return { results: [], message: 'No context entries found. Run `gitwhy init` and make some commits.' };
    }

    /* Embed with 'query' input type — nomic-embed-text uses prefix convention */
    const queryVec = await generateEmbedding(query, 'query');

    /* C engine does the heavy arithmetic — returns [{commitHash, score}] */
    const rawResults = await vectorSearch(queryVec, EMBEDDINGS_PATH, topK);

    /* Hydrate with context metadata and apply minimum score filter */
    const ctxMap = Object.fromEntries(contexts.map(c => [c.commitHash, c]));

    // Hybrid search: combine semantic similarity with keyword matching
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    const results = rawResults
        .filter(r => ctxMap[r.commitHash])
        .map(r => {
            const ctx = ctxMap[r.commitHash];
            const textToSearch = `${ctx.problem} ${ctx.alternatives} ${ctx.files?.join(' ') || ''}`.toLowerCase();
            
            // Calculate keyword match score
            const keywordMatches = queryWords.filter(word => textToSearch.includes(word)).length;
            const keywordScore = queryWords.length > 0 ? keywordMatches / queryWords.length : 0;
            
            // Combine semantic and keyword scores (favor keywords more: 30% semantic, 70% keyword)
            const combinedScore = (r.score * 0.5) + (keywordScore * 0.5);
            
            return { 
                ...ctx, 
                score: combinedScore,
                semanticScore: r.score,
                keywordScore: keywordScore
            };
        })
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score);

    return { results };
}