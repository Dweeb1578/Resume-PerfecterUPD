import os
import sys
import json
import traceback
from pypdf import PdfReader
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, "web", ".env")
load_dotenv(dotenv_path=env_path)

def parse_resume(file_path):
    try:
        # 1. Extract Text
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            print(json.dumps({"error": "No text extracted from PDF"}))
            return

        # 2. Call Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
             print(json.dumps({"error": "GROQ_API_KEY missing"}))
             return

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
                    "bullets": ["Key contribution 1", "Key contribution 2"] 
                } 
            ],
            "education": [ 
                { 
                    "id": "uuid", 
                    "school": "University Name", 
                    "degree": "Degree Name (e.g. BS Computer Science)", 
                    "field": "Field of Study", 
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
                    "description": "Brief description of duties" 
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
        3. **DATES**: Keep original format. If "Present" or "Current" is used, keep it as "Present".
        4. **SKILLS vs SOFT SKILLS**: 
           - **skills**: Technical hard skills ONLY (e.g. Python, SQL, Photoshop, AWS, Spanish).
           - **softSkills**: Interpersonal or abstract skills (e.g. Leadership, Teamwork, Communication, Adaptability).
        5. **BULLETS**: 
           - Split long paragraphs into individual executable bullet points.
           - If a section has no bullets but has a paragraph, split the paragraph into logical sentences/bullets.
        
        SECTION MAPPING GUIDE:
        - "Work Experience", "Professional Experience", "History", "Employment" -> **experience**
        - "Projects", "Technical Projects", "Side Projects" -> **projects**
        - "Education", "Academic Background", "Scholastic Achievements" -> **education**
        - "Leadership", "Positions of Responsibility", "Volunteering" -> **responsibilities**
        - "Skills", "Technical Skills", "Stack" -> **skills**
        - "Achievements", "Awards", "Certifications", "Honors" -> **achievements**

        URL DETECTION RULES (profile section):
        6. **linkedin**: Look for URLs containing "linkedin.com/in/" - extract the full profile URL.
        7. **github**: Look for URLs containing "github.com/" - extract the full profile URL (not repo links).
        8. **website**: Look for personal portfolio URLs, personal websites, or any other relevant links (not LinkedIn/GitHub).
           - Common patterns: behance.net, dribbble.com, portfolio sites, personal domains with names.
        9. If a URL is displayed as anchor text only (e.g., just "LinkedIn" or "GitHub"), still extract if possible or note only.
        10. URLs may appear in the header/contact section or scattered in the resume text.

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
        
        # Clean result
        result = result.replace("```json", "").replace("```", "").strip()
        
        # Validate JSON
        parsed_json = json.loads(result)
        
        # Output to stdout
        print(json.dumps(parsed_json))

    except Exception as e:
        error_info = {
            "error": str(e),
            "trace": traceback.format_exc()
        }
        print(json.dumps(error_info))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        parse_resume(sys.argv[1])
