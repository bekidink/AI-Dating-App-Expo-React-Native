import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize once
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Good defaults for 2026 (high quality, free tier supported)
const EMBEDDING_MODEL = "gemini-embedding-001"; // 768 dimensions – matches many vector indexes; use "models/embedding-001" if you want 3072
const CHAT_MODEL = "gemini-2.5-flash"; // fast, capable, free tier

/**
 * Generate an embedding vector for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set in Convex environment variables",
    );
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent(text.trim()); // trim to avoid empty input errors

  return result.embedding.values;
}

/**
 * Generate a chat completion (optional – if you use this elsewhere)
 */
export async function generateChatCompletion(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 150,
      temperature: options?.temperature ?? 0.7,
    },
  });

  const result = await model.generateContent(prompt.trim());

  return result.response.text() ?? "";
}
