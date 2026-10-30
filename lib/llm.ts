/**
 * LLM and Embedding utilities for CaseMemory.
 * Uses Google Gemini API (or OpenAI compatible) for extraction and vector embeddings.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generates an embedding vector for the provided text.
 * Default model: text-embedding-004 (768 dimensions) via Gemini API.
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY in environment variables");
  }

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
    throw new Error(`Embedding API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Invalid embedding response from model");
  }

  return values;
}

/**
 * Calls the LLM with structured output or plain text generation.
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

