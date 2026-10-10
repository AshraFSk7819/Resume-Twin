from pathlib import Path
import os
from dotenv import load_dotenv
from groq import Groq
import ResumeExt

load_dotenv()
my_api_key = os.getenv("GROQ_API_KEY")

if not my_api_key:
    raise ValueError("wrong api key")

client = Groq(api_key=my_api_key)
model = "openai/gpt-oss-20b"
#### AFTER THIS IS ALL TEMP ##########




def TwinGptStream(resume, question, chat_history):
    system_prompt = f"""
You are a personal profile AI assistant.

Answer questions about the person using only the information
available in their resume.

Do not invent information. If information is missing, say so.
Keep answers clear, concise, and informative.
Politely refuse unrelated questions.

Resume:
{resume.model_dump_json(indent=2)}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        *chat_history,
        {"role": "user", "content": question}
    ]

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        stream=True
    )

    full_answer = ""

    for chunk in response:
        content = chunk.choices[0].delta.content

        if content:
            full_answer += content
            yield content

    # Save the completed exchange for follow-up questions.
    chat_history.append({
        "role": "user",
        "content": question
    })

    chat_history.append({
        "role": "assistant",
        "content": full_answer
    })
    

