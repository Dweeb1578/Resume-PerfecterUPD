import { createOpenAI } from '@ai-sdk/openai';
import Groq from "groq-sdk";

// AI SDK compatible client (used by some routes)
export const groq = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
});

// Direct Groq SDK client (used by parser, analyzer, rewriter)
let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY environment variable is not set");
        }
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
}

/**
 * Clean LLM response by removing markdown code fences and extracting JSON.
 */
export function cleanLLMJson(raw: string): string {
    let result = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    const startIdx = result.indexOf("{");
    if (startIdx === -1) throw new Error("No JSON object found in LLM response");

    let braceCount = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < result.length; i++) {
        if (result[i] === "{") braceCount++;
        else if (result[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }

    return result.slice(startIdx, endIdx);
}
