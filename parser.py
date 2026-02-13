import os
import sys
import json
import traceback
from pypdf import PdfReader
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
web_env_path = os.path.join(script_dir, "web", ".env")
root_env_path = os.path.join(script_dir, ".env")

load_dotenv(dotenv_path=web_env_path)
load_dotenv(dotenv_path=root_env_path)

def parse_resume(file_path):
    try:
        # 1. Extract Text
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # 1b. Extract hyperlink annotations (PDF stores URLs separately from text)
        links = []
        for page in reader.pages:
            if "/Annots" in page:
                for annot in page["/Annots"]:
                    try:
                        annot_obj = annot.get_object()
                        if annot_obj.get("/Subtype") == "/Link" and "/A" in annot_obj:
                            action = annot_obj["/A"]
                            if "/URI" in action:
                                uri = action["/URI"]
                                if uri and isinstance(uri, str):
                                    links.append(uri)
                    except Exception:
                        pass
        
        if links:
            text += "\n\n--- EXTRACTED HYPERLINKS FROM PDF ---\n"
            for link in links:
                text += f"- {link}\n"
        
        if not text.strip():
            return {"error": "No text extracted from PDF"}

        # DEBUG: Save extracted text
        with open("debug_extracted_text.txt", "w", encoding="utf-8") as f:
            f.write(text)

        # 2. Call Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
             return {"error": "GROQ_API_KEY missing"}

        client = Groq(api_key=api_key)
        
        system_prompt = """
        You are an expert Resume Parser. 
        Extract the resume data from the text provided below into the following strict JSON format:
        {
            "profile": { "name": "", "email": "", "phone": "", "linkedin": "", "github": "", "website": "", "summary": "" },
            "experience": [ { "id": "uuid", "company": "", "role": "", "startDate": "", "endDate": "", "location": "", "bullets": [] } ],
            "projects": [ { "id": "uuid", "name": "", "description": "", "technologies": [], "link": "", "bullets": [] } ],
            "education": [ { "id": "uuid", "school": "", "degree": "", "field": "", "startDate": "", "endDate": "", "grade": "" } ],
            "responsibilities": [ { "id": "uuid", "title": "", "organization": "", "location": "", "startDate": "", "endDate": "", "description": "" } ],
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
        - Do not include markdown formatting (like ```json ... ```).
        - Do not include any conversational text.
        """

        completion = client.chat.completions.create(
            messages=[
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Resume Text:\n{text}" }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
            stream=False,
        )

        result = completion.choices[0].message.content
        
        # DEBUG: Save raw LLM response
        with open("debug_llm_response.txt", "w", encoding="utf-8") as f:
            f.write(result)
        
        # Clean result
        result = result.replace("```json", "").replace("```", "").strip()
        
        # Validate JSON
        parsed_json = json.loads(result)
        
        parsed_data = parsed_json

        # POST-PROCESSING: Ensure every item has a unique ID
        import uuid
        
        def ensure_ids(items):
            if not isinstance(items, list): return
            for item in items:
                if isinstance(item, dict):
                    if 'id' not in item or item['id'] == 'uuid' or not item['id']:
                        item['id'] = str(uuid.uuid4())

        ensure_ids(parsed_data.get('responsibilities', []))

        # POST-PROCESSING: Regex Fallback for URLs
        import re
        if not parsed_data.get('profile', {}).get('linkedin'):
            linkedin_match = re.search(r'(https?://)?(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+', text)
            if linkedin_match:
                if 'profile' not in parsed_data: parsed_data['profile'] = {}
                parsed_data['profile']['linkedin'] = linkedin_match.group(0)
        
        if not parsed_data.get('profile', {}).get('github'):
            github_match = re.search(r'(https?://)?(www\.)?github\.com/[a-zA-Z0-9_-]+', text)
            if github_match:
                if 'profile' not in parsed_data: parsed_data['profile'] = {}
                parsed_data['profile']['github'] = github_match.group(0)

        return parsed_data
        
    except Exception as e:
        print(f"Error parsing resume: {e}", file=sys.stderr)
        traceback.print_exc()
        error_info = {
            "error": str(e),
            "trace": traceback.format_exc()
        }
        return error_info

if __name__ == "__main__":
    # Redirect stdout to stderr to prevent libraries from polluting the output
    # expecting clean JSON on the real stdout
    original_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        if len(sys.argv) < 2:
            sys.stdout = original_stdout
            print(json.dumps({"error": "No file path provided"}))
        else:
            input_path = sys.argv[1]
            output_path = sys.argv[2] if len(sys.argv) > 2 else None
            
            result = parse_resume(input_path)
            
            if output_path:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2)
            else:
                sys.stdout = original_stdout
                print(json.dumps(result))
                
    except Exception as e:
        error_res = {"error": str(e)}
        if len(sys.argv) > 2:
            with open(sys.argv[2], 'w', encoding='utf-8') as f:
                json.dump(error_res, f)
        else:
            sys.stdout = original_stdout
            print(json.dumps(error_res))
    finally:
        sys.stdout = original_stdout
