import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Campaign, CampaignAttack, CampaignStatus, Attack
from app.schemas import CampaignCreate, CampaignOut, CampaignDetail
from app.campaign_runner import run_campaign_sync

router = APIRouter(prefix="/api/probes", tags=["probes"])


@router.get("", response_model=list[CampaignOut])
async def list_probes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campaign).order_by(Campaign.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=CampaignOut, status_code=201)
async def create_probe(data: CampaignCreate, db: AsyncSession = Depends(get_db)):
    probe = Campaign(
        name=data.name,
        description=data.description,
        target_id=data.target_id,
    )
    db.add(probe)
    await db.flush()

    for i, aid in enumerate(data.attack_ids):
        ca = CampaignAttack(campaign_id=probe.id, attack_id=aid, order=i)
        db.add(ca)

    await db.commit()
    await db.refresh(probe)
    return probe


@router.get("/{probe_id}", response_model=CampaignDetail)
async def get_probe(probe_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campaign)
        .options(
            selectinload(Campaign.target),
            selectinload(Campaign.campaign_attacks).selectinload(CampaignAttack.attack),
            selectinload(Campaign.campaign_attacks).selectinload(CampaignAttack.results),
        )
        .where(Campaign.id == probe_id)
    )
    probe = result.scalar_one_or_none()
    if not probe:
        raise HTTPException(404, "Probe not found")
    return probe


@router.post("/{probe_id}/run")
async def run_probe(probe_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == probe_id))
    probe = result.scalar_one_or_none()
    if not probe:
        raise HTTPException(404, "Probe not found")

    # Atomic check-and-set to prevent duplicate runner threads
    result = await db.execute(
        update(Campaign)
        .where(Campaign.id == probe_id, Campaign.status != CampaignStatus.RUNNING)
        .values(status=CampaignStatus.RUNNING)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(400, "Probe already running")

    import threading
    thread = threading.Thread(target=run_campaign_sync, args=(probe_id,), daemon=True)
    thread.start()

    return {"message": "Probe started", "probe_id": probe_id}


@router.delete("/{probe_id}", status_code=204)
async def delete_probe(probe_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == probe_id))
    probe = result.scalar_one_or_none()
    if not probe:
        raise HTTPException(404, "Probe not found")
    await db.delete(probe)
    await db.commit()
