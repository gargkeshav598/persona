# 💼 DigitalPersona

> **Don't just view profiles—talk to them.** > An AI-powered chatbot that transforms any professional's digital footprint into an interactive conversation using a structured Context Injection architecture.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)

---

## 📋 About This Project

**The Goal:** Build a system that ingests public data from a LinkedIn profile (mandatory) and an X/Twitter handle (optional), allowing users to ask questions about the person's career, interests, and public activity.

---

## ✨ Key Features

* **Automated Data Extraction:** Seamlessly triggers and polls Bright Data APIs to scrape real-time data from LinkedIn and X simultaneously via `asyncio`.
* **Smart Data Pipeline:** Custom data normalization filters out noise, handles missing fields, and ranks high-signal posts before injecting them into the prompt.
* **Context-Injection Architecture:** Bypasses the need for a vector database by structuring the scraped JSON data and feeding it directly into the LLM's system prompt for high-accuracy, zero-hallucination responses.
* **Modern Interface:** A sleek, responsive React UI featuring Markdown rendering, streaming-style UI updates, and suggested prompts.

---

## 🛠️ Architecture & Tech Stack

<img width="1061" height="673" alt="Screenshot 2026-03-20 at 4 42 08 PM" src="https://github.com/user-attachments/assets/e4c4064a-07e6-44e7-bf29-d274e3d23694" />


| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python, FastAPI | High-performance API routing and async task management. |
| **LLM Inference** | Groq API | Ultra-low latency conversational generation using structured context prompts. |
| **Data Scraping** | Bright Data | Bypassing anti-bot protections to retrieve raw structured JSON. |
| **Frontend** | React (Vite) | Fast, modern, and interactive user interface. |

---

## 🚀 Quick Start Guide

### Prerequisites
You will need Node.js, Python 3.8+, and active API keys for **Groq** and **Bright Data**.

### 1. Backend Setup

Open your terminal and navigate to the backend directory:

```bash
cd backend 

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install required packages
pip install fastapi uvicorn requests python-dotenv groq pydantic
```

Create a `.env` file in the `backend` folder:

```env
BRIGHT_DATA_TOKEN=your_bright_data_api_token
GROQ_API_KEY=your_groq_api_key
FRONTEND_URL=http://localhost:5173
PORT=8000
```

Start the server:

```bash
uvicorn main:app --reload
```

### 2. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

```bash
cd frontend

# Install dependencies
npm install marked dompurify react

# Start the development server
npm run dev
```

## 🔮 Future Perspectives & Scaling
The current architecture prioritizes speed of development and low complexity. Planned scaling initiatives include:

### Persistent Storage:

Moving away from in-memory dictionary storage (sessions: Dict[str, str]) to a persistent database like Redis or PostgreSQL to ensure sessions survive server restarts.

### True RAG Architecture: 

Transitioning from the current direct Context-Injection method to a proper Retrieval-Augmented Generation (RAG) pipeline using a Vector Database (e.g., Pinecone, Weaviate). This will allow the system to handle massive amounts of user activity, thousands of tweets, and long articles by retrieving only the most semantically relevant data, avoiding LLM context window limits.
