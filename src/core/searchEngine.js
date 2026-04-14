import path          from 'path';
import { readFile }  from 'fs/promises';
import { generateEmbedding } from '../ai/embeddings.js';
import { vectorSearch }      from './vectorSearch.js';
import { bm25Search, prepareDocuments } from './bm25.js';


const EMBEDDINGS_PATH = path.join(process.cwd(), '.gitwhy', 'embeddings.json');
const CONTEXTS_PATH   = path.join(process.cwd(), '.gitwhy', 'contexts.json');



/**
 * Main search function using BM25 (primary) + embeddings (boost)
 *
 * BM25 is the industry standard for text search (used by Elasticsearch, Lucene)
 * Embeddings provide semantic understanding as a secondary signal
 *
 * @param {string} query    - Natural language search query
 * @param {number} topK     - Number of results to return
 * @param {number} minScore - Minimum score threshold (0-1)
 */


export async function semanticSearch(query, topK = 5, minScore = 0.1) {
    const raw      = await readFile(CONTEXTS_PATH, 'utf8').catch(() => '[]');
    const contexts = JSON.parse(raw);

    if (contexts.length === 0) {
        return { results: [], message: 'No context entries found. Run `gitwhy init` and make some commits.' };
    }

    // Prepare documents for BM25
    const documents = prepareDocuments(contexts);
    
    // BM25 search (primary ranking)
    const bm25Results = bm25Search(query, documents);
    const bm25Map = Object.fromEntries(bm25Results.map(r => [r.id, r.score]));

    // Try to get embedding-based scores (secondary boost)
    let embeddingMap = {};
    try {
        const queryVec = await generateEmbedding(query, 'query');
        const embeddingResults = await vectorSearch(queryVec, EMBEDDINGS_PATH, contexts.length);
        embeddingMap = Object.fromEntries(embeddingResults.map(r => [r.commitHash, r.score]));
    } catch (err) {
        console.warn('Embedding search failed, using BM25 only:', err.message);
    }

    // Combine scores: 85% BM25 (text matching), 15% embeddings (semantic)
    const ctxMap = Object.fromEntries(contexts.map(c => [c.commitHash, c]));
    
    const results = contexts
        .map(ctx => {
            const bm25Score = bm25Map[ctx.commitHash] || 0;
            const embeddingScore = embeddingMap[ctx.commitHash] || 0;
            
            // Weighted combination
            const combinedScore = (bm25Score * 0.85) + (embeddingScore * 0.15);
            
            return {
                ...ctx,
                score: combinedScore,
                bm25Score: bm25Score,
                embeddingScore: embeddingScore
            };
        })
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return { results };
}