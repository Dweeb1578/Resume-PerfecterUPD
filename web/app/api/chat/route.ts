import Groq from "groq-sdk";

export const maxDuration = 30;

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
    console.log("API /chat called");

    try {
        const { messages } = await req.json();
        console.log("Messages received:", messages.length);
        console.log("GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are an expert Resume Writer helping users ENHANCE their existing resume bullet points using the STAR framework.

CRITICAL: Your job is to IMPROVE the original bullet, NOT replace it. The user's answers provide additional context to strengthen the EXISTING content.

STAR Framework:
- Situation: Context/background
- Task: What was the responsibility
- Action: Specific steps taken
- Result: Quantifiable outcome (metrics, %, numbers)

WHEN THE USER PROVIDES CONTEXT TO IMPROVE A BULLET:
1. READ the original bullet carefully - preserve its core message
2. USE the user's answer to ADD specific metrics, actions, or results
3. OUTPUT an enhanced version that combines BOTH

FORMAT - Output EXACTLY this JSON (no markdown):
{"type":"suggestion","experienceIndex":0,"bulletIndex":0,"original":"[the original bullet text from resume]","suggested":"[ENHANCED version combining original + new context]","reasoning":"[what you improved]"}

ENHANCEMENT RULES:
1. NEVER discard the original bullet's content entirely
2. ADD metrics from user's answer (%, numbers, timeframes)
3. Keep the core achievement/action from the original
4. Make it concise (max 2 lines)
5. Use strong action verbs

EXAMPLE:
Original bullet: "Improved website SEO and search rankings"
User says: "Rankings went from page 3 to page 1, organic traffic increased 45%"
Your suggestion: "Elevated website SEO rankings from page 3 to page 1 through technical optimization and keyword strategy, driving 45% increase in organic traffic"

BAD (don't do this): Completely ignoring the original and just writing about traffic
GOOD: Keeping "SEO rankings" from original, adding the specific metrics

After the JSON, just say: "Here's your improved bullet!" - DO NOT ask follow-up questions.`
                },
                ...messages
            ],
            stream: true,
        });

        // Create a readable stream for the response
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of completion) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            controller.enqueue(encoder.encode(content));
                        }
                    }
                    controller.close();
                } catch (error) {
                    console.error("Stream error:", error);
                    controller.error(error);
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            }
        });

    } catch (e: unknown) {
        const err = e as { message?: string; status?: number; error?: string };
        console.error("API Route Error:", err);
        console.error("Error message:", err?.message);
        console.error("Error status:", err?.status);
        console.error("Error body:", err?.error);
        return new Response(JSON.stringify({ error: err?.message || "Internal Server Error" }), {
            status: err?.status || 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
