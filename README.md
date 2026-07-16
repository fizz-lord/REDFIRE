# REDFIRE 🔥 — LLM Red Teaming Platform

REDFIRE is an open-source AI red teaming platform built for security researchers, penetration testers, and developers who need to evaluate the safety of large language models. It provides a full-featured web application for systematically probing LLMs against the OWASP Top 10 for LLM Applications, automating attack generation, and producing professional audit reports.

## What It Does

REDFIRE lets you target any LLM — whether it's a cloud-hosted API like NVIDIA or OpenAI, a local model running through Ollama, or any custom OpenAI-compatible endpoint — and test it against a library of 35+ attack prompts across categories like jailbreaking, prompt injection, PII extraction, harmful content generation, and data exfiltration.

The platform works by sending curated attack prompts to the target model, scoring each response on a 0–100 scale, and classifying the result as SAFE, UNCLEAR, JAILBROKEN, or BLOCKED. It uses both rule-based signal detection and an LLM-as-judge to evaluate whether the model was compromised. Every interaction is logged, scored, and available for review.

## Core Features

### Vuln Scan
Run batch attack campaigns against a target. Select multiple attacks from the library, assign them to a target, and the platform executes them in the background. Each result is scored and classified. Results update in real-time with a status indicator.

### Compare
Send the same prompt to multiple targets simultaneously and compare responses side by side. Useful for evaluating which models are more resistant to specific attack vectors.

### Conversations
Multi-turn chat interface with any configured target. Each message is scored automatically. Full conversation history is logged and exportable.

### Auto Agent
An automated red team agent that runs iterative attack rounds against a target. Each round generates a new attack prompt, sends it to the model, evaluates the response, and uses the result to inform the next round. Configurable by category and number of rounds.

### Extract Prompt
Attempts to extract the system prompt from a target model using 16+ techniques including direct request, role play, prefix completion, format shifting, token stealing, attention shifting, and recursive prompting. Each technique is tested and scored for extraction confidence.

### Attack Library
35+ pre-seeded attacks across 7 OWASP LLM categories: jailbreak, prompt injection, harmful content, PII extraction, data extraction, misinformation, and denial of service. Each attack has a severity level (critical/high/medium/low) and relevant MITRE ATLAS and OWASP LLM IDs.

### Reports
Generate aggregated reports from all platform data — vuln scans, comparisons, conversations, agent runs, extractions, and reviews. Reports include executive summaries, false positive detection, verdict breakdowns, and target details. Export as HTML, JSON, Markdown, or PDF.

### Review Queue
Maintain a human review queue for verifying automated results. Queue items from any section, assign verdicts (confirmed breach, false positive, uncertain, refusal), and add notes.

### Dashboard
Visual overview of platform activity with charts showing severity distribution, category breakdowns, and key metrics. Built with Recharts.

## Supported Providers

| Provider | Notes |
|----------|-------|
| NVIDIA | OpenAI-compatible API. Choose `custom` provider, set Base URL to `https://integrate.api.nvidia.com/v1/chat/completions` |
| OpenAI | Native API support |
| Ollama | Local models via Ollama |
| Custom | Any OpenAI-compatible endpoint |

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
