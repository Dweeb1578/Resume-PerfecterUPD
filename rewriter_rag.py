import os
import sys
import json
import traceback
from groq import Groq
from dotenv import load_dotenv
import google.generativeai as genai
from pinecone import Pinecone

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
web_env_path = os.path.join(script_dir, "web", ".env")
root_env_path = os.path.join(script_dir, ".env")

load_dotenv(dotenv_path=web_env_path)
load_dotenv(dotenv_path=root_env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

# Configure APIs
genai.configure(api_key=GEMINI_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)
INDEX_NAME = "resume-bullets"

def search_similar_bullets(query_text, top_k=3):
    """Search Pinecone for similar high-quality bullet examples."""
    try:
        embedding_result = genai.embed_content(
            model="models/text-embedding-004",
            content=query_text,
            task_type="retrieval_query"
        )
        vector = embedding_result['embedding']
        
        index = pc.Index(INDEX_NAME)
        results = index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True
        )
        
        return [match.metadata.get("text", "") for match in results.matches]
    except Exception as e:
        print(f"RAG Search Error: {e}", file=sys.stderr)
        return []

def rewrite_with_rag(json_str):
    try:
        if not json_str:
            print(json.dumps({"error": "No JSON provided"}))
            return

        resume_data = json.loads(json_str)

        if not GROQ_API_KEY:
            print(json.dumps({"error": "GROQ_API_KEY missing"}))
            return
        if not GEMINI_API_KEY or not PINECONE_API_KEY:
            print(json.dumps({"error": "GEMINI/PINECONE keys missing - falling back to basic rewrite"}))
            # Fall back to basic rewriting without RAG
            pass

        client = Groq(api_key=GROQ_API_KEY)

        # 1. Collect all bullets and find similar examples
        all_bullets = []
        for exp in resume_data.get("experience", []):
            for bullet in exp.get("bullets", []):
                all_bullets.append(bullet)
        for proj in resume_data.get("projects", []):
            for bullet in proj.get("bullets", []):
                all_bullets.append(bullet)

        # 2. For each weak bullet, find 2 similar high-quality examples
        example_bullets = []
        for bullet in all_bullets[:5]:  # Limit to first 5 to avoid API overload
            similar = search_similar_bullets(bullet, top_k=2)
            example_bullets.extend(similar)
        
        # Deduplicate
        example_bullets = list(set(example_bullets))[:10]

        # 3. Build enhanced prompt with examples
        examples_text = "\n".join([f"- {b}" for b in example_bullets]) if example_bullets else "No examples available."

        system_prompt = f"""
        You are a World-Class Resume Writer & Career Coach.
        Your goal is to REWRITE the provided resume data to be "Perfect".

        REFERENCE EXAMPLES - These are high-quality bullet points from similar roles:
        {examples_text}
        
        Use these as stylistic inspiration. Match their:
        - Strong action verbs
        - Metric-driven results
        - Concise, impactful phrasing
        
        OBJECTIVES:
        1. **Impactful Bullets**: Rewrite every experience and project bullet using the **STAR Method**.
        2. **Strong Verbs**: Start every bullet with a power verb (Led, Engineered, Orchestrated, etc.).
        3. **Optimization**: Remove fluff, filler words, and weak phrasing.
        
        CRITICAL RULES:
        1. **NO HALLUCINATIONS**: Do NOT invent numbers, metrics, companies, or degrees.
        2. **KEEP STRUCTURE**: Return the EXACT same JSON structure.
        3. **PROFESSIONAL TONE**: Use formal, punchy professional English.
        4. **SUMMARY**: Rewrite "profile.summary" to be a compelling 2-sentence elevator pitch.
        5. **DEDUPLICATION**: If the same role/organization appears in BOTH "experience" AND "responsibilities", REMOVE IT from one section:
           - Keep PAID work, internships, and jobs in "experience" only.
           - Keep UNPAID roles, volunteer positions, club activities, and student organizations in "responsibilities" only.
           - Never output the same role twice.
        
        OUTPUT: Strict valid JSON only.
        """

        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Resume JSON:\n{json.dumps(resume_data)}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            stream=False,
        )

        result = completion.choices[0].message.content
        result = result.replace("```json", "").replace("```", "").strip()
        
        parsed_json = json.loads(result)
        
        # Add metadata to show RAG was used
        parsed_json["_rag_enhanced"] = True
        parsed_json["_examples_used"] = len(example_bullets)
        
        print(json.dumps(parsed_json))

    except Exception as e:
        error_info = {
            "error": str(e),
            "trace": traceback.format_exc()
        }
        print(json.dumps(error_info))

if __name__ == "__main__":
    # Read JSON from stdin to avoid Windows shell escaping issues
    json_input = sys.stdin.read()
    if not json_input.strip():
        print(json.dumps({"error": "No JSON input provided via stdin"}))
    else:
        rewrite_with_rag(json_input)
