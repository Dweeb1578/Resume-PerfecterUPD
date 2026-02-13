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

        # DEBUG: Print incoming resume structure to server logs
        try:
             debug_json = json.loads(resume_json_str)
             print(f"DEBUG_ANALYZER_INPUT: Experience Count: {len(debug_json.get('experience', []))}", file=sys.stderr)
             print(f"DEBUG_ANALYZER_INPUT: Projects Count: {len(debug_json.get('projects', []))}", file=sys.stderr)
             print(f"DEBUG_ANALYZER_INPUT: Responsibilities Count: {len(debug_json.get('responsibilities', []))}", file=sys.stderr)
             print(f"DEBUG_ANALYZER_INPUT: Full JSON Keys: {list(debug_json.keys())}", file=sys.stderr)
        except:
             print("DEBUG_ANALYZER_INPUT: Could not parse input JSON for debug", file=sys.stderr)

        # 2. Call Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
             print(json.dumps({"error": "GROQ_API_KEY missing"}))
             return

        client = Groq(api_key=api_key)
        
        parsed_data = debug_json

        # 3. Analyze Sections Individually (Divide & Conquer)
        final_output = {
            "intro": "",
            "critical": [],
            "warning": [],
            "niceToHave": []
        }

        sections_to_analyze = [
            ("experience", parsed_data.get("experience", [])),
            ("project", parsed_data.get("projects", [])),
            ("responsibility", parsed_data.get("responsibilities", [])) # Note: parser uses 'responsibilities', output uses 'responsibility' singular usuallly but strict json says 'responsibility'
        ]

        # Shared client
        client = Groq(api_key=api_key)
        
        # Function to analyze a specific list of items
        def analyze_section_items(section_name, items):
            if not items: return None
            
            # Detailed prompt for focused analysis with all categories
            prompt = f"""
            You are an expert Resume Critic.
            Analyze ONLY the following `{section_name}` items from a resume.
            
            ITEMS TO ANALYZE:
            {json.dumps(items, indent=2)}

            OUTPUT FORMAT (Strict JSON):
            {{
                "critical": [ {{"section": "{section_name}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."}} ],
                "warning": [ {{"section": "{section_name}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."}} ],
                "niceToHave": [ {{"section": "{section_name}", "id": "uuid", "quote": "text", "bulletIndex": 0, "question": "...", "issue": "..."}} ]
            }}

            CATEGORIES:
            - **Critical**: Missing metrics, vague claims, grammar errors, weak impact.
            - **Warning**: Passive voice, generic phrases ("Responsible for"), lack of context.
            - **NiceToHave**: Suggestions to make it perfect (stronger verbs, better formatting).

            RULES:
            1. Analyze EVERY item in the list.
            2. Return "id", "quote", "bulletIndex" exactly as in input.
            3. "section" must be "{section_name}".
            4. Provide a mix of Critical, Warning, and NiceToHave. Do not mark everything as Critical.
            """

            try:
                msg = client.chat.completions.create(
                    messages=[
                        { "role": "system", "content": prompt },
                        { "role": "user", "content": "Analyze these items." }
                    ],
                    model="llama-3.3-70b-versatile",
                    temperature=0.1,
                    stream=False,
                )
                txt = msg.choices[0].message.content.replace("```json", "").replace("```", "").strip()
                # find brace
                s = txt.find('{')
                e = txt.rfind('}') + 1
                return json.loads(txt[s:e])
            except Exception as e:
                print(f"DEBUG: Failed to analyze {section_name}: {e}", file=sys.stderr)
                return None

        # Execute analysis
        for name, items in sections_to_analyze:
            print(f"DEBUG: Analyzing section: {name} ({len(items)} items)", file=sys.stderr)
            res = analyze_section_items(name, items)
            if res:
                final_output["critical"].extend(res.get("critical", []))
                final_output["warning"].extend(res.get("warning", []))
                final_output["niceToHave"].extend(res.get("niceToHave", []))

        # Generate Intro (Separate quick call or just generic)
        try:
            intro_prompt = f"""
            Based on this resume profile, write a 1-sentence summary of its strength.
            Profile: {json.dumps(parsed_data.get('profile', {}))}
            Experience Titles: {[e.get('role') for e in parsed_data.get('experience', [])]}
            """
            intro_msg = client.chat.completions.create(
                messages=[{"role": "user", "content": intro_prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.3
            )
            final_output["intro"] = intro_msg.choices[0].message.content.strip()
        except:
            final_output["intro"] = "Here is the analysis of your resume."

        # Output to stdout
        print(json.dumps(final_output))

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
