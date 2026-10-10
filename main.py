
from pathlib import Path
import shutil
#FOR BACKEND
from fastapi import FastAPI, File, HTTPException, UploadFile # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from fastapi.responses import StreamingResponse # type: ignore
#FOR RESUME
import ResumeExt
# FOR CHAT 
import Twin

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "https://resume-twin-frontend.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Each session has its own conversation history.
chat_sessions: dict[str, list[dict[str, str]]] = {}

PDF_PATH = Path("resume.pdf")
JSON_PATH = Path("resume_data.json")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.get("/")
def home():
    return {"message": "Resume Twin API is running!"}


@app.post("/upload")
def upload_resume(file: UploadFile = File(...)):

    # Check the file extension
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(400, "Please upload a PDF.")

    # Check file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size == 0:
        raise HTTPException(400, "The file is empty.")

    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "PDF must be 10 MB or smaller.")

    # Check PDF signature
    if file.file.read(5) != b"%PDF-":
        raise HTTPException(400, "Invalid PDF file.")

    file.file.seek(0)

    # Save the uploaded PDF
    with PDF_PATH.open("wb") as saved_file:
        shutil.copyfileobj(file.file, saved_file)

    # Extract resume information and create JSON
    try:
        info = ResumeExt.GetJson(PDF_PATH)

        JSON_PATH.write_text(
            info.model_dump_json(indent=4),
            encoding="utf-8"
        )

    except Exception as exc:
        print("ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Resume processing failed: {exc}"
        ) from exc
    chat_sessions.clear()
    return {
        "message": "Resume uploaded successfully!",
        "resume_info": info.model_dump(mode="json")
    }


from pydantic import BaseModel



class ChatRequest(BaseModel):
    question: str
    session_id: str



@app.post("/chat")
def chat(request: ChatRequest):
    if not JSON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Please upload a resume first."
        )

    if request.session_id not in chat_sessions:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found. Create a new chat."
        )

    resume = ResumeExt.Resume.model_validate_json(
        JSON_PATH.read_text(encoding="utf-8")
    )

    return StreamingResponse(
        Twin.TwinGptStream(
            resume,
            request.question,
            chat_sessions[request.session_id]
        ),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache"}
    )
    
from uuid import uuid4

@app.post("/new-chat")
def new_chat():
    session_id = str(uuid4())
    chat_sessions[session_id] = []

    return {"session_id": session_id}

class ResetRequest(BaseModel):
    session_id: str


@app.post("/reset-chat")
def reset_chat(request: ResetRequest):
    if request.session_id not in chat_sessions:
        raise HTTPException(404, "Chat session not found.")

    chat_sessions[request.session_id].clear()

    return {"message": "Conversation reset successfully."}

