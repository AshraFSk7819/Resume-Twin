from pathlib import Path
import os
from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel
import json
import pymupdf # type:ignore


load_dotenv()
my_api_key = os.getenv("GROQ_API_KEY")

if not my_api_key:
    raise ValueError("wrong api key")

client = Groq(api_key=my_api_key)
model = "openai/gpt-oss-20b"


class Exp(BaseModel):
    company : str | None = None
    role : str | None = None
    duration : str | None = None
    description : str | None = None
    skills_used : list[str] = []

class Resume(BaseModel):
    name : str | None = None
    email : str | None = None
    phone : str | None = None 
    
    Total_exp : str | None = None 
    
    skills : list[str] = []
    experience : list[Exp] = []
    education : list[str] = []
    projects : list[str] = []
    certifications : list[str] = []
    Achievments : list[str] = []
    Social_links : list[str] = []
######################################
# METHOD FOR RESUME GETTING (LLM CALL 1)
resume_schema = Resume.model_json_schema()

def parse_text(text):
    system_prompt = f"""
    You are an expert resume parser.

    Extract information from the resume based on its meaning,
    not only based on exact section headings.

    Different resumes may use different headings.

    For example:
    - Experience
    - Professional Experience
    - Work History
    - Employment
    - Internships

    These may all contain relevant experience.

    Skills may also appear in the skills section, work experience,
    internships or projects.

    Return ONLY valid JSON matching this schema:

    {resume_schema}

    Important rules:

    1. Do not invent information.
    2. If a value is not available, return null.
    3. If a list has no information, return an empty list.
    4. Include internships inside experiences.
    5. Extract skills mentioned across the entire resume.
    """
    user_prompt = f"""
    Parse the following resume:

    {text}
    """
    message_system={
        "role" : "system",
        "content" : system_prompt
    }
    message_user={
        "role" : "user",
        "content" : user_prompt
    }
    messages=[message_system, message_user]
    response_format={
        "type": "json_object"
    }
    response=client.chat.completions.create(model=model, messages=messages,reasoning_effort="low", response_format=response_format,max_completion_tokens=2048)
    raw_output = response.choices[0].message.content
    data = json.loads(raw_output) # data is a dict or json now 
    resume = Resume(**data) # basically assiging the data to a class and creating a object 
    return resume




def text_extract(pdf_path: str | Path) -> str:
    with pymupdf.open(pdf_path) as doc:
        text = ""
        for page in doc:
            text += page.get_text()
    return text



#### AFTER THIS IS ALL TEMP ##########


def GetJson(pdf_path: str | Path) -> Resume:
    text = text_extract(pdf_path)
    info = parse_text(text)
    return info



