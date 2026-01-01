import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Using 2.0 Flash Exp for speed/quality in parsing
export const geminiFlash = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
export const geminiEmbed = genAI.getGenerativeModel({ model: "text-embedding-004" });
