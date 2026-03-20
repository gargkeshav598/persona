from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import requests
import os
from dotenv import load_dotenv
load_dotenv()
import uuid
import asyncio
from groq import Groq


try:
    from .pipeline import build_llm_input
except ImportError:
    try:
        from pipeline import build_llm_input
    except ImportError:
        from backend.pipeline import build_llm_input

app = FastAPI(title="Profile Chatbot API")
print("Starting FastAPI app...")


# CORS configuration for frontend origins
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

allowed_origins = [
    "http://localhost:5173",  # Vite dev
    "http://127.0.0.1:5173",
    "http://localhost:5500"
]

if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi.responses import Response

# Specific OPTIONS handlers for CORS preflight


# Setup API Keys
BRIGHT_DATA_TOKEN = os.getenv("BRIGHT_DATA_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not BRIGHT_DATA_TOKEN or not GROQ_API_KEY:
    print("WARNING: Missing API keys. App will start but endpoints may fail.")

groq_client = Groq(api_key=GROQ_API_KEY)
sessions: Dict[str, str] = {}

# --- Pydantic Models ---
class ProfileURLs(BaseModel):
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None

class ChatMessage(BaseModel):
    session_id: str
    message: str


# --- Helper Functions ---

def trigger_extraction(dataset_id: str, url: str, extra_params: dict = None) -> str:
    """Triggers Bright Data extraction and returns the snapshot_id."""
    api_url = "https://api.brightdata.com/datasets/v3/trigger"
    headers = {
        "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}",
        "Content-Type": "application/json",
    }
    params = {"dataset_id": dataset_id, "include_errors": "true"}
    if extra_params:
        params.update(extra_params)
        
    data = [{"url": url}]
    if dataset_id == "gd_lwxkxvnf1cynvib9co": # Twitter specific payload
        data = [{"url": url, "start_date": "", "end_date": ""}]

    response = requests.post(api_url, headers=headers, params=params, json=data)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Trigger failed: {response.text}")
    
    # Extract and return the snapshot_id from the response
    return response.json().get("snapshot_id")


async def poll_brightdata_snapshot(snapshot_id: str, max_retries: int = 30, wait_time: int = 10) -> Any:
    """Polls the Bright Data snapshot URL until the data is ready."""
    url = f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json"
    headers = {"Authorization": f"Bearer {BRIGHT_DATA_TOKEN}"}

    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        # 200 means the data is ready and returned
        if response.status_code == 200:
            return response.json()
        
        # 202 usually means it is still processing
        elif response.status_code == 202:
            print(f"Snapshot {snapshot_id} still processing... waiting {wait_time}s (Attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(wait_time)
            
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Polling error: {response.text}")
            
    raise HTTPException(status_code=408, detail="Timeout waiting for Bright Data extraction to complete.")


# --- Master Orchestration API ---

@app.post("/api/process-profile")
async def process_profile(req: ProfileURLs):
    """
    Automates the entire flow: 
    1. Triggers LinkedIn & Twitter scrapes.
    2. Polls both until data is ready.
    3. Builds the pipeline.
    4. Returns a session_id for chatting.
    """
    li_data, tw_data = None, None

    try:
        # 1. Trigger the jobs
        if req.linkedin_url:
            print("Triggering LinkedIn scrape...")
            li_snapshot = trigger_extraction("gd_l1viktl72bvl7bjuj0", req.linkedin_url)
            
        if req.twitter_url:
            print("Triggering Twitter scrape...")
            tw_snapshot = trigger_extraction(
                "gd_lwxkxvnf1cynvib9co", 
                req.twitter_url, 
                {"type": "discover_new", "discover_by": "profile_url_most_recent_posts"}
            )

        # 2. Poll for the results concurrently
        # We use asyncio.gather to wait for both at the same time, cutting wait time in half
        tasks = []
        if req.linkedin_url:
            tasks.append(poll_brightdata_snapshot(li_snapshot))
        if req.twitter_url:
            tasks.append(poll_brightdata_snapshot(tw_snapshot))

        results = await asyncio.gather(*tasks)

        # Assign results based on what was requested
        idx = 0
        if req.linkedin_url:
            li_data = results[idx]
            idx += 1
        if req.twitter_url:
            tw_data = results[idx]

        # 3. Build the LLM input via your pipeline
        context_string = build_llm_input(li_data, tw_data)
        
        # 4. Generate Session ID and Store
        session_id = str(uuid.uuid4())
        sessions[session_id] = context_string
        
        return {
            "status": "success", 
            "session_id": session_id,
            "message": "Scraping complete. Profile data processed and ready for chat."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Chat API ---

@app.post("/api/chat")
def chat_with_profile(req: ChatMessage):
    """Chats with Groq using the saved profile context."""
    context = sessions.get(req.session_id)
    
    if not context:
        raise HTTPException(status_code=404, detail="Session not found. Please process the profile first.")

    system_prompt = (
        "You are an expert career and profile analyzer. "
        "Use the following profile context to answer the user's questions about this person. "
        f"Profile Context:\n{context}"
    )

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ],
           model="openai/gpt-oss-120b",
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            reasoning_effort="medium",
            stream=False,
            stop=None
        )
        return {"reply": chat_completion.choices[0].message.content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")

# --- Health Check ---
@app.get("/")
def health_check():
    return {"status": "ok"}

# --- Run Server (for local/dev & deployment platforms like Render/Railway) ---
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)