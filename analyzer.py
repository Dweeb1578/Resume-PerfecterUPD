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
        Analyze the provided resume JSON and identify specific issues with the **bullets**.
        
        Your output must be a strict JSON object with this format:
        {
            "intro": "A 1-sentence high-level summary of the resume's strength.",
            "critical": [
                {"experienceIndex": 0, "bulletIndex": 1, "question": "Clarifying question?", "issue": "Why this is critical"}
            ],
            "warning": [ ...same format... ],
            "niceToHave": [ ...same format... ]
        }
        
        CATEGORIES:
        - **Critical**: Missing metrics for major claims, vague impact, spelling/grammar errors, lies, or major red flags.
        - **Warning**: Weak action verbs, passive voice, confusing phrasing, or lack of context.
        - **NiceToHave**: Suggestions to make it "perfect" (e.g. better quantifiers, removing filler words).
        
        RULES:
        1. Reference `experienceIndex` and `bulletIndex` accurately based on the input JSON's `experience` array.
        2. Be extremely specific. "Action verb is weak" is bad. "Changed 'Worked on' to 'Spearheaded' to show leadership" is good.
        3. Do NOT hallucinate indices. Only critique existing bullets.
        4. Focus 80% of effort on the `experience` section.
        5. Return ONLY raw JSON.
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
        print(json.dumps({"error": "No resume JSON provided"}))
    else:
        # Read JSON from argument (passed as string)
        analyze_resume(sys.argv[1])
