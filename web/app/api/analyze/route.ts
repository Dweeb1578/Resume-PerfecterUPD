import { groq } from "@/lib/groq";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
    const { resumeData } = await req.json();

    const result = await streamText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
            {
                role: "system",
                content: `You are a Senior Resume Reviewer. Analyze ALL bullet points and categorize gaps by severity.

OUTPUT FORMAT - You MUST output exactly this JSON (no markdown):
{
    "intro": "Brief greeting, max 15 words",
    "critical": [
        {"experienceIndex": 0, "bulletIndex": 0, "question": "What was the specific metric?", "issue": "This bullet lacks any quantifiable results or numbers."}
    ],
    "warning": [
        {"experienceIndex": 0, "bulletIndex": 1, "question": "How did you achieve this?", "issue": "The action verb 'helped' is weak and vague."}
    ],
    "niceToHave": [
        {"experienceIndex": 1, "bulletIndex": 0, "question": "Can you add more context?", "issue": "Already good, but adding timeframe would strengthen it."}
    ]
}

SEVERITY DEFINITIONS:

🔴 CRITICAL - Bullets that MUST be fixed:
- No quantifiable results or metrics at all
- Very vague with no specific actions
- Just lists responsibilities without achievements
- Missing impact entirely

🟡 WARNING - Should be improved:
- Has some metrics but could be more specific
- Weak action verbs ("helped", "assisted", "worked on")
- Missing the "how" or methodology
- Partial STAR format

🟢 NICE-TO-HAVE - Optional improvements:
- Already good but could be slightly stronger
- Minor wording improvements
- Adding more context would help

RULES:
1. Analyze EVERY bullet point in ALL experiences thoroughly
2. You MUST find at least 3 critical issues - look harder for missing metrics, vague language, or weak verbs
3. Put the WORST issues in critical (MINIMUM 3 critical, aim for 3-5)
4. Put medium issues in warning (aim for 2-4 warnings)
5. Put minor issues in niceToHave (0-3 is fine)
5. experienceIndex: 0 = first/most recent job
6. bulletIndex: 0 = first bullet in that job
7. QUESTIONS must be proper full sentences asking for specific info
8. ISSUES must be complete sentences explaining what's wrong (10-15 words)
7. Questions should ask for specific metrics, methods, or outcomes
8. Keep questions under 25 words

Output ONLY valid JSON, no additional text.`
            },
            {
                role: "user",
                content: `Resume Data: ${JSON.stringify(resumeData)}`
            }
        ],
    });

    return result.toTextStreamResponse();
}
