import { truncateDiff } from '../core/diffAnalyser.js';

export async function generateSummary(rawDiff) {
    const truncated = truncateDiff(rawDiff);
    const GITWHY_API = process.env.GITWHY_API_URL || 'http://51.21.226.149:3000';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${GITWHY_API}/api/analyze-diff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diff: truncated }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
            problem: data.problem.trim(),
            alternatives: data.alternatives.trim()
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Server timeout after 15 seconds');
        }
        throw new Error(`Server unavailable: ${error.message}`);
    }
}
