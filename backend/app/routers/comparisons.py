import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Comparison, ComparisonResult, Target
from app.schemas import ComparisonCreate, ComparisonOut
from app.providers import call_provider
from app.scoring import score_response

router = APIRouter(prefix="/api/comparisons", tags=["comparisons"])


@router.get("", response_model=list[ComparisonOut])
async def list_comparisons(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Comparison).options(selectinload(Comparison.results)).order_by(Comparison.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ComparisonOut, status_code=201)
async def run_comparison(data: ComparisonCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id.in_(data.target_ids)))
    targets = result.scalars().all()
    if not targets:
        raise HTTPException(404, "No valid targets found")

    comparison = Comparison(prompt=data.prompt)
    db.add(comparison)
    await db.commit()
    await db.refresh(comparison)

    async def run(t: Target):
        start = time.time()
        resp = await call_provider(
            t.provider, data.prompt, t.decrypted_api_key or "", t.model, t.endpoint or "",
        )
        elapsed = round((time.time() - start) * 1000, 1)

        response_text = resp if resp else "[Error: No response]"
        error = ""
        if resp and resp.startswith("[Error:"):
            error = resp
            response_text = resp

        sd = score_response(data.prompt, response_text, "high")

        return ComparisonResult(
            comparison_id=comparison.id,
            target_id=t.id,
            target_name=t.name,
            model=t.model,
            response=response_text,
            score=sd["score"],
            label=sd["label"],
            refusal_signals=sd["refusal_signals"],
            compliance_signals=sd["compliance_signals"],
            details=sd["detail"],
            response_time_ms=elapsed,
            error=error,
        )

    results = await asyncio.gather(*[run(t) for t in targets])

    for r in results:
        db.add(r)
    await db.commit()

    result = await db.execute(
        select(Comparison).options(selectinload(Comparison.results)).where(Comparison.id == comparison.id)
    )
    return result.scalar_one()


@router.get("/{comparison_id}", response_model=ComparisonOut)
async def get_comparison(comparison_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Comparison).options(selectinload(Comparison.results)).where(Comparison.id == comparison_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Comparison not found")
    return c


@router.delete("/{comparison_id}", status_code=204)
async def delete_comparison(comparison_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Comparison).where(Comparison.id == comparison_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Comparison not found")
    await db.delete(c)
    await db.commit()
