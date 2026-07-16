"""Human-in-the-loop review queue."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Review, QuickTestLog, AgentAttack
from app.schemas import ReviewOut, ReviewUpdate

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.post("/queue", response_model=list[ReviewOut], status_code=201)
async def queue_for_review(limit: int = 20, min_score: float = 50.0, db: AsyncSession = Depends(get_db)):
    """Pull un-reviewed results from quick_test and agent sources."""
    existing = await db.execute(select(Review.source_id, Review.source_table))
    existing_keys = {(r.source_id, r.source_table) for r in existing.scalars().all()}

    # We actually need to iterate properly
    existing_pairs = set()
    for row in (await db.execute(select(Review.source_id, Review.source_table))).all():
        existing_pairs.add((row[0], row[1]))

    reviews_created = 0

    for source_table, model_cls in [("quick_test", QuickTestLog), ("agent", AgentAttack)]:
        rows = await db.execute(
            select(model_cls).limit(limit * 2)
        )
        for item in rows.scalars().all():
            if (item.id, source_table) in existing_pairs:
                continue

            score = getattr(item, "score", 0) or 0
            if score < min_score:
                continue

            review = Review(
                source_table=source_table,
                source_id=item.id,
                prompt=getattr(item, "prompt", "") or "",
                response=getattr(item, "response", "") or "",
                score=score,
                label=getattr(item, "label", "") or "",
            )
            db.add(review)
            existing_pairs.add((item.id, source_table))
            reviews_created += 1
            if reviews_created >= limit:
                break
        if reviews_created >= limit:
            break

    await db.commit()

    result = await db.execute(
        select(Review).where(Review.reviewed == False).order_by(Review.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("", response_model=list[ReviewOut])
async def list_reviews(reviewed: bool = False, source: str = "", db: AsyncSession = Depends(get_db)):
    q = select(Review).where(Review.reviewed == reviewed)
    if source:
        q = q.where(Review.source_table == source)
    q = q.order_by(Review.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{review_id}", response_model=ReviewOut)
async def update_review(review_id: int, data: ReviewUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review not found")
    if data.verdict:
        review.verdict = data.verdict
    if data.notes:
        review.notes = data.notes
    review.reviewed = True
    await db.commit()
    await db.refresh(review)
    return review


@router.delete("/{review_id}", status_code=204)
async def delete_review(review_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review not found")
    await db.delete(review)
    await db.commit()
