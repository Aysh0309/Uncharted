/**
 * LLM and Embedding utilities for CaseMemory.
 * Supports Google Gemini API (default) and OpenAI-compatible endpoints.
 */

export const DEFAULT_EMBEDDING_DIMENSION = 768; // Gemini text-embedding-004

/**
 * Returns the configured vector embedding dimensions.
 * Defaults to 768 (Gemini text-embedding-004). Set EMBEDDING_DIMENSIONS in .env if using OpenAI (1536).
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
 * Generates an embedding vector for the provided text.
 * Default: Google Gemini `text-embedding-004` (768 dimensions).
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
    const res = await fetch("https://api.openai.com/v1/embeddings", {
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
  const model = process.env.EMBEDDING_MODEL || "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${model}`,
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Embedding API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Invalid embedding response from Gemini model");
  }

  return values;
}

/**
 * Calls the LLM for structured extraction or conversational analysis.
 * Default model: gemini-1.5-flash
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

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  const model = process.env.LLM_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("LLM did not return text response");
  }

  return text;
}
