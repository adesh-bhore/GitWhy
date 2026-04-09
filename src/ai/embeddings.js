/**
 * Embedding generation via GitWhy server (no local Ollama needed)
 */

const GITWHY_API = process.env.GITWHY_API_URL || 'http://51.21.226.149:3000';

/**
 * Generate a semantic embedding vector for the given text.
 *
 * @param {string} text       - Text to embed
 * @param {'document'|'query'} inputType - 'document' for storage, 'query' for search
 * @returns {Promise<number[]>} - Float array of length 768
 */
export async function generateEmbedding(text, inputType = 'document') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${GITWHY_API}/api/generate-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, inputType }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response');
    }

    return data.embedding;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Embedding generation timeout');
    }
    throw new Error(`Embedding failed: ${error.message}`);
  }
}

/**
 * Convenience wrapper — generates a query-type embedding.
 * Used exclusively by the search engine at query time.
 */
export async function generateQueryEmbedding(query) {
  return generateEmbedding(query, 'query');
}
