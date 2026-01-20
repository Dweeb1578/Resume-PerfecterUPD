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

def rewrite_resume(json_str):
    try:
        # Validate input
        if not json_str:
             print(json.dumps({"error": "No JSON provided"}))
             return

        resume_data = json.loads(json_str)

        # 2. Call Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
             print(json.dumps({"error": "GROQ_API_KEY missing"}))
             return

        client = Groq(api_key=api_key)
        
        system_prompt = """
        You are a World-Class Resume Writer & Career Coach.
        Your goal is to REWRITE the provided resume data to be "Perfect".
        
        OBJECTIVES:
        1. **Impactful Bullets**: Rewrite every experience and project bullet using the **STAR Method** (Situation, Task, Action, Result).
        2. **Strong Verbs**: Start every bullet with a power verb (e.g., Spearheaded, Engineered, Orchestrated).
        3. **Optimization**: Remove fluff, filler words, and weak phrasing.
        4. **Soft Skills**: If "softSkills" is empty in the input, infer 3-5 high-value soft skills from the experience and add them.
        
        CRITICAL RULES - READ CAREFULLY:
        1. **NO HALLUCINATIONS**: Do NOT invent numbers, metrics, companies, or degrees. If a metric isn't there, focus on the qualitative impact (e.g., "improving efficiency" instead of "improving efficiency by 50%").
        2. **KEEP STRUCTURE**: Return the EXACT same JSON structure. Do not add or remove top-level fields.
        3. **PROFESSIONAL TONE**: Use formal, punchy professional English.
        4. **SUMMARY**: Rewrite the "profile.summary" to be a compelling 2-sentence elevator pitch.
        
        INPUT DATA:
        The user's current resume JSON.

        OUTPUT:
        Strict valid JSON only.
        """

        completion = client.chat.completions.create(
            messages=[
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": f"Resume JSON:\n{json.dumps(resume_data)}" }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2, # Low temp for consistency but slight creativity in phrasing
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
        print(json.dumps({"error": "No JSON argument provided"}))
    else:
        rewrite_resume(sys.argv[1])
