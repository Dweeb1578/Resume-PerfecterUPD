import { NextRequest, NextResponse } from "next/server";
import { getGroqClient, cleanLLMJson } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const parsedData = await req.json();

        console.log("DEBUG_ANALYZER: Experience Count:", (parsedData.experience || []).length);
        console.log("DEBUG_ANALYZER: Projects Count:", (parsedData.projects || []).length);
        console.log("DEBUG_ANALYZER: Responsibilities Count:", (parsedData.responsibilities || []).length);

        const client = getGroqClient();

        // Sections to analyze
        const sectionsToAnalyze: [string, unknown[]][] = [
            ["experience", parsedData.experience || []],
            ["project", parsedData.projects || []],
            ["responsibility", parsedData.responsibilities || []],
        ];

        const finalOutput: {
            intro: string;
            critical: unknown[];
            warning: unknown[];
            niceToHave: unknown[];
        } = {
            intro: "",
            critical: [],
            warning: [],
            niceToHave: [],
        };

        // Analyze each section
        for (const [sectionName, items] of sectionsToAnalyze) {
            if (!items || (items as unknown[]).length === 0) continue;

            console.log(`DEBUG_ANALYZER: Analyzing section: ${sectionName} (${(items as unknown[]).length} items)`);

            const prompt = `
            You are an expert Resume Critic.
            Analyze ONLY the following \`${sectionName}\` items from a resume.
            
            ITEMS TO ANALYZE:
            ${JSON.stringify(items, null, 2)}

            OUTPUT FORMAT (Strict JSON):
            {
                "critical": [ {"section": "${sectionName}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."} ],
                "warning": [ {"section": "${sectionName}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."} ],
                "niceToHave": [ {"section": "${sectionName}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."} ]
            }

            CATEGORIES:
            - **Critical**: Missing metrics, vague claims, grammar errors, weak impact.
            - **Warning**: Passive voice, generic phrases ("Responsible for"), lack of context.
            - **NiceToHave**: Suggestions to make it perfect (stronger verbs, better formatting).

            RULES:
            1. Analyze EVERY item in the list.
            2. Return "id", "quote", "bulletIndex" exactly as in input.
            3. "section" must be "${sectionName}".
            4. Provide a mix of Critical, Warning, and NiceToHave. Do not mark everything as Critical.
            `;

            try {
                const msg = await client.chat.completions.create({
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: "Analyze these items." },
                    ],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.1,
                    stream: false,
                });

                const rawText = msg.choices[0]?.message?.content || "";
                const cleaned = cleanLLMJson(rawText);
                const result = JSON.parse(cleaned);

                finalOutput.critical.push(...(result.critical || []));
                finalOutput.warning.push(...(result.warning || []));
                finalOutput.niceToHave.push(...(result.niceToHave || []));
            } catch (e) {
                console.error(`DEBUG_ANALYZER: Failed to analyze ${sectionName}:`, e);
            }
        }

        // Generate intro
        try {
            const introPrompt = `
            Based on this resume profile, write a 1-sentence summary of its strength.
            Profile: ${JSON.stringify(parsedData.profile || {})}
            Experience Titles: ${JSON.stringify((parsedData.experience || []).map((e: Record<string, unknown>) => e.role))}
            `;
            const introMsg = await client.chat.completions.create({
                messages: [{ role: "user", content: introPrompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
            });
            finalOutput.intro = introMsg.choices[0]?.message?.content?.trim() || "Here is the analysis of your resume.";
        } catch {
            finalOutput.intro = "Here is the analysis of your resume.";
        }

        return NextResponse.json(finalOutput, { status: 200 });

    } catch (error) {
        console.error("Analyzer API Error:", error);
        return NextResponse.json(
            { error: "Analysis failed", details: (error as Error).message },
            { status: 500 }
        );
    }
}
