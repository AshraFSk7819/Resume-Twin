# Resume Twin

**A clearer view of your experience.**

Resume Twin is an AI-powered resume assistant that lets you upload your resume as a PDF and ask questions about your skills, experience, projects, and qualifications through a conversational interface.

## Live Demo

- **Frontend:** [Resume Twin](https://resume-twin-frontend.vercel.app)
- **Backend API:** [Resume Twin API](https://resume-twin.onrender.com)

## Features

- **PDF Resume Upload** — Upload your resume to get started.
- **AI-Powered Chat** — Ask questions about your resume in natural language.
- **Streaming Responses** — Receive responses as they are generated.
- **Multiple Chat Sessions** — Keep conversations organized across sessions.
- **Markdown Support** — Read formatted responses, lists, and tables.
- **Clean User Interface** — A modern onboarding screen with suggested questions.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| AI | Groq API |
| Resume Processing | PDF extraction utilities |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

## How It Works

1. Upload your resume in PDF format.
2. Resume Twin processes the resume.
3. Ask questions about your professional background.
4. Receive AI-generated responses based on the available resume information.

## Run Locally

### Prerequisites

- Python
- [uv](https://docs.astral.sh/uv/)
- A Groq API key

### 1. Clone the repository

```bash
git clone https://github.com/AshraFSk7819/Resume-Twin.git
cd Resume-Twin
```

### 2. Install dependencies

```bash
uv sync
```

### 3. Configure the API key

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
```

Replace `your_groq_api_key` with your own API key. Keep `.env` private and never commit it to GitHub.

### 4. Start the backend

```bash
uv run uvicorn main:app --reload
```

The backend will run at `http://127.0.0.1:8000`.

### 5. Start the frontend

Open another terminal from the project root:

```bash
python -m http.server 5500 --directory frontend
```

Open `http://127.0.0.1:5500` in your browser.

For local development, configure the frontend API URL to use `http://127.0.0.1:8000`. For the deployed frontend, use the Render backend URL.

## Environment Variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Authenticates requests to the Groq API |

## Project Structure

```text
Resume-Twin/
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── main.py
├── ResumeExt.py
├── Twin.py
├── pyproject.toml
├── uv.lock
├── .gitignore
└── README.md
```

## Deployment

- The frontend is hosted on Vercel.
- The FastAPI backend is hosted on Render.
- The frontend communicates with the backend through its API endpoints.

## Future Improvements

- Improve resume parsing and answer accuracy.
- Add stronger session isolation and persistent conversation storage.
- Add support for more resume formats.
- Improve error handling and deployment monitoring.

## License

No license has been specified yet. Contact the repository owner before reusing or distributing this project.
