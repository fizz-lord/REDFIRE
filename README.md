# REDFIRE 🔥 — LLM Red Teaming Platform

REDFIRE is an AI red teaming platform for testing LLM safety. It lets you:

- Run **Vuln Scans** (batch attack campaigns) against any LLM target
- Run **side-by-side comparisons** of multiple models
- Have **multi-turn conversations** with a target model
- Run an **automated red team agent** that iteratively attacks the model
- Attempt **system prompt extraction** with 16+ techniques
- Generate **professional reports** (HTML / JSON / Markdown / PDF) with false-positive detection
- Maintain a **human review queue** for verifying results

> Built for the OWASP LLM Top 10. Works with OpenAI-compatible APIs (NVIDIA, OpenAI, local Ollama, custom endpoints).

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- An API key for a model provider (e.g. NVIDIA `integrate.api.nvidia.com`)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # then add your API key
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The backend runs at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

Open `http://localhost:5173` in your browser.

---

## Configuration

Create `backend/.env` (see `.env.example`):

```ini
DATABASE_URL=sqlite+aiosqlite:///redfire.db
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxx
```

### Adding a Target

In the **Targets** page, add a target:

| Field | Example |
|-------|---------|
| Name | Llama 3.2 3B |
| Provider | `custom` (for OpenAI-compatible APIs) |
| Model | `meta/llama-3.2-3b-instruct` |
| API Key | `nvapi-...` |
| Base URL | `https://integrate.api.nvidia.com/v1/chat/completions` |

NVIDIA's API is OpenAI-compatible, so choose `custom` as the provider and set the Base URL to `https://integrate.api.nvidia.com/v1/chat/completions`.

For a local model, install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.2:1b`), and add a target with provider `ollama`, Base URL `http://localhost:11434/v1/chat/completions`.

---

## Features

| Section | Description |
|---------|-------------|
| **Dashboard** | Overview stats and charts |
| **Vuln Scan** | Run attack campaigns against a target |
| **Attack Library** | 35+ seeded attacks across OWASP categories |
| **Targets** | Configure models to test |
| **Conversations** | Multi-turn chat with scoring |
| **Compare** | Side-by-side model comparison |
| **Extract Prompt** | System prompt extraction attempts |
| **Auto Agent** | Iterative automated red teaming |
| **Reports** | Aggregated reports + review queue |
| **History** | Searchable test log |

---

## License

MIT
