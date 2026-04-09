import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'GitWhy API' });
});

// Generate commit context from diff using Grok
app.post('/api/analyze-diff', async (req, res) => {
  try {
    const { diff } = req.body;

    if (!diff) {
      return res.status(400).json({ error: 'Diff is required' });
    }

    const SYSTEM_PROMPT = `You are a senior software engineer analyzing a git diff.
Your job is to infer the developer's intent from the code changes alone.

Return ONLY a JSON object with exactly this shape — no preamble, no explanation, no markdown:
{
  "problem": "One clear sentence describing the problem this change solves. Be specific and technical.",
  "alternatives": "One sentence describing what approach was likely considered and rejected, or 'No alternatives apparent from the diff' if genuinely unclear."
}

Guidelines:
- Infer from the actual code, not from generic patterns
- "problem" should describe a user-facing or system-level problem, not the implementation
- Bad: "Refactored the auth module"
- Good: "Users could reuse JWT tokens after logout because token invalidation was not tracked"
- If you see a test being added, infer what bug the test is preventing
- If you see error handling being added, describe what failure mode it addresses`;

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this git diff and infer the developer's intent:\n\n\`\`\`diff\n${diff}\n\`\`\``;

    // Call Grok API with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY }`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Analyze this git diff and infer the developer's intent:\n\n\`\`\`diff\n${diff}\n\`\`\``
          }
        ],
        temperature: 0.7
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();

    // Strip markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      
      if (typeof parsed.problem !== 'string' || typeof parsed.alternatives !== 'string') {
        throw new Error('Invalid response shape');
      }

      res.json({
        problem: parsed.problem.trim(),
        alternatives: parsed.alternatives.trim()
      });
    } catch (parseErr) {
      // Fallback
      res.json({
        problem: text.slice(0, 300),
        alternatives: 'Unable to determine from diff'
      });
    }

  } catch (error) {
    console.error('Error analyzing diff:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      cause: error.cause
    });
    res.status(500).json({ 
      error: 'Failed to analyze diff',
      message: error.message,
      details: error.code || error.name
    });
  }
});

// Generate embeddings using Voyage AI (free tier, no credit card)
app.post('/api/generate-embedding', async (req, res) => {
  try {
    const { text, inputType = 'document' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Use Voyage AI for embeddings (free tier available)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY }`
      },
      body: JSON.stringify({
        model: 'voyage-3-lite',
        input: [text],
        input_type: inputType === 'query' ? 'query' : 'document'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voyage API error: ${errorText}`);
    }

    const data = await response.json();
    res.json({ embedding: data.data[0].embedding });

  } catch (error) {
    console.error('Error generating embedding:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      cause: error.cause
    });
    res.status(500).json({ 
      error: 'Failed to generate embedding',
      message: error.message,
      details: error.code || error.name
    });
  }
});

app.listen(PORT, () => {
  console.log(`GitWhy API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
