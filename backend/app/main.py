"""REDFIRE API - LLM Red Teaming Backend"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import targets, attacks, probes, results, transforms_api, conversations, comparisons, exports, extractions, agent, reviews, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="REDFIRE API",
    description="LLM Red Teaming Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(targets.router)
app.include_router(attacks.router)
app.include_router(probes.router)
app.include_router(results.router)
app.include_router(transforms_api.router)
app.include_router(conversations.router)
app.include_router(comparisons.router)
app.include_router(exports.router)
app.include_router(extractions.router)
app.include_router(agent.router)
app.include_router(reviews.router)
app.include_router(reports.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
