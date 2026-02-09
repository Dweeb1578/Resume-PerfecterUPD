import os
import sys
import json
import traceback
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, "web", ".env")
load_dotenv(dotenv_path=env_path)

def analyze_resume(resume_json_str):
    try:
        # Validate inputs
        if not resume_json_str:
             print(json.dumps({"error": "No resume data provided"}))
             return

        # 2. Call Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
             print(json.dumps({"error": "GROQ_API_KEY missing"}))
             return

        client = Groq(api_key=api_key)
        
        system_prompt = """
        You are an expert Resume Critic from top tech companies (Google, Meta, etc.).
        Analyze the provided resume JSON and identify specific issues with bullets/descriptions in experience, projects, AND responsibilities (positions of responsibility).
        
        Your output must be a strict JSON object with this format:
        {
            "intro": "A 1-sentence high-level summary of the resume's strength.",
            "critical": [
                {"experienceIndex": 0, "bulletIndex": 1, "question": "Clarifying question?", "issue": "Why this is critical"},
                {"projectIndex": 0, "bulletIndex": 0, "question": "...", "issue": "..."},
                {"responsibilityIndex": 0, "question": "...", "issue": "..."}
            ],
            "warning": [ ...same format, can have experienceIndex, projectIndex, OR responsibilityIndex... ],
            "niceToHave": [ ...same format... ]
        }
        
        CATEGORIES:
        - **Critical**: Missing metrics for major claims, vague impact, spelling/grammar errors, lies, major red flags, or WEAK POINTS THAT SHOULD BE REMOVED (suggest hiding them).
        - **Warning**: Weak action verbs, passive voice, confusing phrasing, lack of context, or generic statements that add no value.
        - **NiceToHave**: Suggestions to make it "perfect" (e.g. better quantifiers, removing filler words).
        
        RULES:
        1. Reference `experienceIndex` + `bulletIndex` for experience, `projectIndex` + `bulletIndex` for projects, OR `responsibilityIndex` for positions of responsibility.
        2. Be extremely specific. "Action verb is weak" is bad. "Changed 'Worked on' to 'Spearheaded' to show leadership" is good.
        3. Do NOT hallucinate indices. Only critique existing items.
        4. For weak, generic, or low-value items, suggest the user HIDE them to save space.
        5. Analyze `experience`, `projects`, AND `responsibilities` sections thoroughly.
        6. Return ONLY raw JSON.
        """

        completion = client.chat.completions.create(
            messages=[
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Resume JSON:\n{resume_json_str}" }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1, # Low temperature for consistent structure but slight creativity in critique
            stream=False,
        )

        result = completion.choices[0].message.content
        
        # Clean result - remove markdown code blocks
        result = result.replace("```json", "").replace("```", "").strip()
        
        # Extract JSON object using brace counting (handles extra text after JSON)
        start_idx = result.find('{')
        if start_idx == -1:
            print(json.dumps({"error": "No JSON object found in response"}))
            return
        
        brace_count = 0
        end_idx = start_idx
        for i, char in enumerate(result[start_idx:], start=start_idx):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        json_str = result[start_idx:end_idx]
        
        # Validate JSON
        parsed_json = json.loads(json_str)
        
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
        print(json.dumps({"error": "No resume JSON provided"}))
    else:
        # Read JSON from argument (passed as string)
        analyze_resume(sys.argv[1])
