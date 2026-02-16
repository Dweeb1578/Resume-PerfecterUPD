import { NextRequest, NextResponse } from "next/server";
import { getGroqClient, cleanLLMJson } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel function timeout (seconds)

const SYSTEM_PROMPT = `
You are an expert Resume Parser. 
Extract the resume data from the text provided below into the following strict JSON format:
{
    "profile": { "name": "", "email": "", "phone": "", "linkedin": "", "github": "", "website": "", "summary": "" },
    "experience": [ { "id": "uuid", "company": "", "role": "", "startDate": "", "endDate": "", "location": "", "bullets": [] } ],
    "projects": [ { "id": "uuid", "name": "", "description": "", "technologies": [], "link": "", "bullets": [] } ],
    "education": [ { "id": "uuid", "school": "", "degree": "", "field": "", "startDate": "", "endDate": "", "grade": "" } ],
    "responsibilities": [ { "id": "uuid", "title": "", "organization": "", "location": "", "startDate": "", "endDate": "", "description": "", "bullets": ["Action/Result 1", "Action/Result 2"] } ],
    "achievements": [ "Achievement 1 with details", "Achievement 2 with details" ],
    "skills": [],
    "softSkills": []
}

SECTION HEADER MAPPINGS - Map these variations to our fields:

EXPERIENCE (put in "experience"):
- "Work Experience", "Professional Experience", "Employment History", "Career History"
- "Work History", "Professional Background", "Experience", "Internships"
- "Relevant Experience", "Industry Experience"

EDUCATION (put in "education"):
- "Education", "Academic Background", "Educational Qualifications", "Academic History"
- "Degrees", "Schooling", "Academic Credentials"

PROJECTS (put in "projects"):
- "Projects", "Personal Projects", "Academic Projects", "Key Projects"
- "Technical Projects", "Portfolio", "Side Projects"

SKILLS (put in "skills"):
- "Skills", "Technical Skills", "Core Competencies", "Key Skills"
- "Expertise", "Proficiencies", "Technologies", "Tools & Technologies"

ACHIEVEMENTS (put in "achievements"):
- "Achievements", "Certifications", "Awards", "Honors"
- "Accomplishments", "Courses", "Licenses", "Publications"
- "Achievements & Certifications", "Awards & Honors"

RESPONSIBILITIES (put in "responsibilities"):
- "Positions of Responsibility", "Leadership", "Extracurriculars"
- "Volunteer Work", "Community Involvement", "Activities"
- "Leadership Experience", "Organizational Roles"

SOFT SKILLS (put in "softSkills"):
- "Soft Skills", "Interpersonal Skills", "Professional Attributes"
- "Languages" (if spoken languages), "Communication"

You are an expert Resume Parser. 
Your goal is to extract structured data from the resume text provided below with 100% precision.

STRICT JSON OUTPUT FORMAT:
{
    "profile": { 
        "name": "Full Name", 
        "email": "email@example.com", 
        "phone": "+1-555-0100", 
        "linkedin": "linkedin.com/in/...", 
        "github": "github.com/...", 
        "website": "portfolio.com", 
        "summary": "Brief professional summary if present" 
    },
    "experience": [ 
        { 
            "id": "uuid", 
            "company": "Company Name", 
            "role": "Job Title", 
            "startDate": "MM/YYYY or YYYY", 
            "endDate": "MM/YYYY, YYYY or Present", 
            "location": "City, Country", 
            "bullets": ["Action verb + context + result", "Another bullet"] 
        } 
    ],
    "projects": [ 
        { 
            "id": "uuid", 
            "name": "Project Name", 
            "description": "Brief description", 
            "technologies": ["React", "Python"], 
            "link": "github/demo link", 
            "github": "github.com/...",
            "startDate": "MM/YYYY or YYYY",
            "endDate": "MM/YYYY, YYYY or Present",
            "bullets": ["Key contribution 1", "Key contribution 2"] 
        } 
    ],
    "education": [ 
        { 
            "id": "uuid", 
            "school": "University Name", 
            "degree": "Masters / Bachelors / B.Tech / M.S. etc (degree type only, NOT the field)", 
            "field": "Computer Science / Physics / Electronics etc (the major/specialization)", 
            "startDate": "Year", 
            "endDate": "Year", 
            "grade": "GPA/Grade" 
        } 
    ],
    "responsibilities": [ 
        { 
            "id": "uuid", 
            "title": "Role Title", 
            "organization": "Organization Name", 
            "location": "", 
            "startDate": "", 
            "endDate": "", 
            "description": "Brief description of duties",
            "bullets": ["Action/Result 1", "Action/Result 2"]
        } 
    ],
    "achievements": [ 
        "Winner of X Hackathon (2023)", 
        "AWS Certified Solutions Architect" 
    ],
    "skills": ["Python", "React"], 
    "softSkills": ["Leadership", "Communication", "Problem Solving"]
}

CRITICAL RULES - DO NOT IGNORE:
1. **NO HALLUCINATIONS**: If a field is not explicitly present in the text, return an empty string "" or empty list []. Do NOT invent dates, emails, or locations.
2. **ROLE vs COMPANY**: 
   - 'role' is the Job Title (e.g., "Software Engineer", "Product Manager").
   - 'company' is the Organization/Employer (e.g., "Google", "Startup Inc").
   - Do not swap these.
3. **DATES**: 
   - Keep original format. If "Present" or "Current" is used, keep it as "Present".
   - If dates are missing or just show "–" with no actual dates, use empty strings "" for startDate and endDate.
   - Do NOT put "–" as a date value.
4. **SKILLS vs SOFT SKILLS**: 
   - **skills**: Technical hard skills ONLY (e.g. Python, SQL, Photoshop, AWS, Spanish).
   - **softSkills**: Interpersonal or abstract skills (e.g. Leadership, Teamwork, Communication, Adaptability).
5. **BULLETS**: 
   - Split long paragraphs into individual executable bullet points.
   - If a section has no bullets but has a paragraph, split the paragraph into logical sentences/bullets.

6. **EXPERIENCE vs RESPONSIBILITIES - VERY IMPORTANT**:
   - **experience**: ONLY for paid work, internships, or professional employment at companies/organizations.
     Examples: "Software Engineer at Google", "Marketing Intern at Startup", "KPMG", "SARC"
   - **responsibilities**: For unpaid leadership roles, club positions, student organizations, volunteer work.
     Examples: "Event Management Head at Verba Maximus", "Actor at Dramatics Club", "Member of Astronomy Club"
   - If a section is titled "Professional Experience" but contains club/volunteer roles, put them in **responsibilities** NOT experience.
   - If the organization is a college club, fest, society, or student body → it goes in **responsibilities**.

7. **DEDUPLICATION**:
   - If the same role+organization appears in multiple sections of the resume, extract it ONCE only.
   - Prefer the version with more details (bullets, dates) if duplicates exist.
   - Do NOT create duplicate entries in the output JSON.

8. **ORGANIZATION EXTRACTION**:
   - For club roles, the format is often "Role Title – Organization Name" (separated by dash).
   - Extract "Event Management Head" as title, "Verba Maximus" as organization.
   - Do not leave organization empty if it appears after the dash.

SECTION MAPPING GUIDE:
- "Work Experience", "Professional Experience", "History", "Employment" -> **experience** (but filter for actual jobs only)
- "Projects", "Technical Projects", "Side Projects" -> **projects**
- "Education", "Academic Background", "Scholastic Achievements" -> **education**
- "Leadership", "Positions of Responsibility", "Volunteering", "Extracurriculars" -> **responsibilities**
- "Skills", "Technical Skills", "Stack" -> **skills**
- "Achievements", "Awards", "Certifications", "Honors" -> **achievements**

9. **EDUCATION PARSING**:
   - **degree**: ONLY the degree type (e.g., "Masters in Physics", "B.Tech", "Bachelors", "B.E.").
   - **field**: The major/specialization/branch SEPARATE from degree (e.g., "Electronics and Electrical Engineering", "Computer Science").
   - If the resume says "B.Tech in Computer Science", degree = "B.Tech", field = "Computer Science".
   - If someone has dual degrees like "M.Sc. Physics + B.E. Electronics", put the primary or first one's type in degree, and use field for the specialization.
   - If field is not explicitly stated or is already fully contained in the degree string, use empty string "" for field.
   - **NEVER** put the literal word "Major" as the field value. Extract the actual major name or leave empty.

URL DETECTION RULES (profile section):
6. **linkedin**: Look for URLs containing "linkedin.com/in/" - extract the full profile URL.
7. **github**: Look for URLs containing "github.com/" - extract the full profile URL (not repo links).
8. **website**: Look for personal portfolio URLs, personal websites, or any other relevant links (not LinkedIn/GitHub).
   - Common patterns: behance.net, dribbble.com, portfolio sites, personal domains with names.
9. If a URL is displayed as anchor text only (e.g., just "LinkedIn" or "GitHub"), still extract if possible or note only.
10. URLs may appear in the header/contact section or scattered in the resume text.
11. PDFs often lose hyperlinks during text extraction. Look for text patterns like "github.com/username" even without "https://" prefix.

OUTPUT INSTRUCTIONS:
- Return ONLY valid JSON.
- Do not include markdown formatting (like \`\`\`json ... \`\`\`).
- Do not include any conversational text.
`;

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        console.log("----- PARSER API (TypeScript) START -----");

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Extract text from PDF using pdf-parse
        let text: string;
        try {
            const bytes = await file.arrayBuffer();
            const uint8 = new Uint8Array(bytes);

            // Polyfill browser APIs that pdfjs-dist checks at load time
            // (not actually used for text extraction, only for rendering)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = globalThis as any;
            if (!g.DOMMatrix) {
                g.DOMMatrix = class DOMMatrix {
                    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
                    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
                    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
                    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
                    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
                    is2D = true; isIdentity = true;
                    inverse() { return new DOMMatrix(); }
                    multiply() { return new DOMMatrix(); }
                    scale() { return new DOMMatrix(); }
                    translate() { return new DOMMatrix(); }
                    transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
                };
            }
            if (!g.Path2D) {
                g.Path2D = class Path2D { };
            }

            // Use pdfjs-dist directly for serverless compatibility
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfjsLib = await import("pdfjs-dist") as any;

            // Disable worker for serverless environment
            if (pdfjsLib.GlobalWorkerOptions) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = "";
            }

            const getDoc = pdfjsLib.getDocument || pdfjsLib.default?.getDocument;
            if (!getDoc) {
                throw new Error("pdfjs-dist getDocument not found. Keys: " + Object.keys(pdfjsLib).join(", "));
            }

            const loadingTask = getDoc({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
            const pdfDoc = await loadingTask.promise;

            const textParts: string[] = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const content = await page.getTextContent();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pageText = content.items.map((item: any) => item.str).join(" ");
                textParts.push(pageText);
            }
            text = textParts.join("\n");
        } catch (pdfErr: unknown) {
            console.error("PDF extraction failed:", pdfErr);
            return NextResponse.json(
                { error: "PDF extraction failed", details: (pdfErr as Error).message },
                { status: 500 }
            );
        }

        if (!text.trim()) {
            return NextResponse.json({ error: "No text extracted from PDF" }, { status: 400 });
        }

        console.log("Extracted text length:", text.length);

        // 2. Call Groq LLM to parse the resume
        let rawResult: string;
        try {
            const client = getGroqClient();
            const completion = await client.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `Resume Text:\n${text}` },
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0,
                stream: false,
            });
            rawResult = completion.choices[0]?.message?.content || "";
            if (!rawResult) {
                return NextResponse.json({ error: "No response from LLM" }, { status: 500 });
            }
        } catch (groqErr: unknown) {
            console.error("Groq API call failed:", groqErr);
            return NextResponse.json(
                { error: "LLM API call failed", details: (groqErr as Error).message },
                { status: 500 }
            );
        }

        // 3. Clean and parse JSON
        let json: Record<string, unknown>;
        try {
            const cleanedJson = cleanLLMJson(rawResult);
            json = JSON.parse(cleanedJson);
        } catch (jsonErr: unknown) {
            console.error("JSON parsing failed:", jsonErr);
            return NextResponse.json(
                { error: "Failed to parse LLM response as JSON", details: (jsonErr as Error).message },
                { status: 500 }
            );
        }

        if (json.error) {
            return NextResponse.json({ error: json.error }, { status: 400 });
        }

        // 4. Post-process: Add unique IDs
        const addId = (item: Record<string, unknown>) => ({
            ...item,
            id: (item.id && item.id !== "uuid" && item.id !== "") ? item.id : Math.random().toString(36).substr(2, 9),
        });
        if (json.experience) json.experience = (json.experience as Record<string, unknown>[]).map(addId);
        if (json.projects) json.projects = (json.projects as Record<string, unknown>[]).map(addId);
        if (json.education) json.education = (json.education as Record<string, unknown>[]).map(addId);
        if (json.responsibilities) json.responsibilities = (json.responsibilities as Record<string, unknown>[]).map(addId);

        // 5. Post-process: Strip trailing "Remote" from company names
        if (json.experience) {
            json.experience = (json.experience as Record<string, unknown>[]).map((exp: Record<string, unknown>) => {
                const company = (exp.company as string) || "";
                if (company.match(/\s+Remote$/i)) {
                    return {
                        ...exp,
                        company: company.replace(/\s+Remote$/i, "").trim(),
                        location: (exp.location as string) || "Remote",
                    };
                }
                return exp;
            });
        }

        // 6. Post-process: Regex fallback for URLs
        const profile = (json.profile || {}) as Record<string, unknown>;
        if (!profile.linkedin) {
            const linkedinMatch = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/);
            if (linkedinMatch) {
                profile.linkedin = linkedinMatch[0];
                json.profile = profile;
            }
        }
        if (!profile.github) {
            const githubMatch = text.match(/(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+/);
            if (githubMatch) {
                profile.github = githubMatch[0];
                json.profile = profile;
            }
        }

        console.log("----- PARSER API SUCCESS -----");
        return NextResponse.json(json);

    } catch (error: unknown) {
        console.error("----- PARSER API ERROR -----", error);
        return NextResponse.json(
            { error: "Failed to parse resume", details: (error as Error).message },
            { status: 500 }
        );
    }
}
