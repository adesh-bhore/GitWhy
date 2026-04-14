/**
 * BM25 (Best Matching 25) - Industry standard ranking function for text search
 * Used by Elasticsearch, Lucene, and most search engines
 */

/**
 * Tokenize and normalize text
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Calculate Inverse Document Frequency
 */
function calculateIDF(term, documents) {
  const docsWithTerm = documents.filter(doc => doc.tokens.includes(term)).length;
  const N = documents.length;
  return Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
}

/**
 * Calculate term frequency in document
 */
function termFrequency(term, tokens) {
  return tokens.filter(t => t === term).length;
}

/**
 * BM25 scoring function
 * @param {string} query - Search query
 * @param {Array} documents - Array of {id, text, tokens}
 * @param {number} k1 - Term frequency saturation parameter (default: 1.5)
 * @param {number} b - Length normalization parameter (default: 0.75)
 */
export function bm25Search(query, documents, k1 = 1.5, b = 0.75) {
  const queryTokens = tokenize(query);
  
  if (queryTokens.length === 0) {
    return [];
  }

  // Calculate average document length
  const avgDocLength = documents.reduce((sum, doc) => sum + doc.tokens.length, 0) / documents.length;

  // Calculate IDF for each query term
  const idfCache = {};
  for (const term of queryTokens) {
    if (!idfCache[term]) {
      idfCache[term] = calculateIDF(term, documents);
    }
  }

  // Score each document
  const scores = documents.map(doc => {
    let score = 0;

    for (const term of queryTokens) {
      const tf = termFrequency(term, doc.tokens);
      const idf = idfCache[term];
      const docLength = doc.tokens.length;

      // BM25 formula
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
      
      score += idf * (numerator / denominator);
    }

    return {
      id: doc.id,
      score: score,
      maxScore: queryTokens.length * Math.max(...Object.values(idfCache))
    };
  });

  // Normalize scores to 0-1 range
  const maxPossibleScore = Math.max(...scores.map(s => s.score));
  
  return scores.map(s => ({
    id: s.id,
    score: maxPossibleScore > 0 ? s.score / maxPossibleScore : 0
  }));
}

/**
 * Prepare documents for BM25 search
 */
export function prepareDocuments(contexts) {
  return contexts.map(ctx => ({
    id: ctx.commitHash,
    text: `${ctx.problem} ${ctx.alternatives} ${ctx.files?.join(' ') || ''}`,
    tokens: tokenize(`${ctx.problem} ${ctx.alternatives} ${ctx.files?.join(' ') || ''}`),
    context: ctx
  }));
}
