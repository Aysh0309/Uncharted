/**
 * LLM and Embedding utilities for CaseMemory.
 * Supports Google Gemini API (default) and OpenAI-compatible endpoints.
 */

export const DEFAULT_EMBEDDING_DIMENSION = 768; // Gemini text-embedding-004 / gemini-embedding-001 (768 dimensions)

/**
 * Returns the configured vector embedding dimensions.
 * Defaults to 768 (Gemini text-embedding-004 / gemini-embedding-001).
 * Set EMBEDDING_DIMENSIONS in .env if using OpenAI (1536).
 */
export function getEmbeddingDimension(): number {
  if (process.env.EMBEDDING_DIMENSIONS) {
    const dim = parseInt(process.env.EMBEDDING_DIMENSIONS, 10);
    if (!isNaN(dim) && dim > 0) return dim;
  }
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  if (provider === "openai") {
    return 1536;
  }
  return DEFAULT_EMBEDDING_DIMENSION;
}

/**
 * Helper to fetch with retry for transient network issues or rate limits (429, 503).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
  backoffMs = 600
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000), // 15s max timeout to prevent indefinite hangs
      });
      if (res.ok || (res.status !== 429 && res.status !== 503)) {
        return res;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      } else {
        return res;
      }
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  return fetch(url, options);
}

/**
 * Generates an embedding vector for the provided text.
 * Default: Google Gemini `text-embedding-004` / `gemini-embedding-001` (768 dimensions).
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing LLM_API_KEY in environment variables. Please set it in .env.local"
    );
  }

  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

  if (provider === "openai") {
    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
    const res = await fetchWithRetry("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }

  // Default: Gemini API
  const primaryEmbedModel = process.env.EMBEDDING_MODEL || "text-embedding-004";
  const embedCandidates = Array.from(
    new Set([primaryEmbedModel, "text-embedding-004", "gemini-embedding-001"])
  );

  let lastError = "";
  for (const model of embedCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    const requestBody: Record<string, unknown> = {
      model: `models/${model}`,
      content: {
        parts: [{ text }],
      },
      outputDimensionality: getEmbeddingDimension(),
    };

    try {
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const values = data?.embedding?.values;
        if (Array.isArray(values)) {
          return values;
        }
      }

      lastError = await response.text();
      // On 404 or 503, try next candidate
      if (response.status === 404 || response.status === 503 || response.status === 429) {
        console.warn(`Embedding model ${model} returned (${response.status}), falling back to alternative...`);
        continue;
      }

      throw new Error(`Gemini Embedding API error (${response.status}): ${lastError}`);
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`Embedding attempt with ${model} failed, falling back...`);
    }
  }

  throw new Error(`All embedding models failed. Last error: ${lastError}`);
}

/**
 * Calls the LLM for structured extraction or conversational analysis.
 * Supported model env var: LLM_MODEL (defaults to "gemini-1.5-flash" on Gemini).
 * Automatically falls back to supported models on 404 (not found) and 503 (high demand).
 */
export async function callLLM(
  prompt: string,
  systemInstruction?: string,
  options?: { jsonMode?: boolean; temperature?: number }
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY in environment variables");
  }

  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

  if (provider === "openai") {
    const model = process.env.LLM_MODEL || "gpt-4o-mini";
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI LLM error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // Default: Gemini API
  // Configurable via LLM_MODEL with documented reliable default "gemini-1.5-flash"
  const envModel = process.env.LLM_MODEL || "gemini-1.5-flash";
  let primaryModel = envModel;
  if (primaryModel.toLowerCase() === "latest") {
    primaryModel = "gemini-1.5-flash";
  }

  // Candidate chain: user configured model -> gemini-1.5-flash -> gemini-2.0-flash -> gemini-1.5-flash-8b
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ])
  );

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.1,
      ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let lastErrorText = "";
  for (const modelCandidate of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;
    try {
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (typeof text === "string") {
          return text;
        }
      }

      lastErrorText = await response.text();
      // On 404 (model not found/supported in region), 503 (high demand), or 429 (rate limit), fallback
      if (response.status === 404 || response.status === 503 || response.status === 429) {
        console.warn(`Model ${modelCandidate} returned (${response.status}), falling back to next candidate...`);
        continue;
      }

      throw new Error(`LLM API error (${response.status}): ${lastErrorText}`);
    } catch (err: any) {
      lastErrorText = err.message || String(err);
      console.warn(`Model ${modelCandidate} failed (${err.message}), trying next candidate...`);
    }
  }

  throw new Error(`All LLM candidate models failed. Last error: ${lastErrorText}`);
}

/**
 * Strips markdown code block wrappers from JSON strings returned by LLMs.
 */
export function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}
