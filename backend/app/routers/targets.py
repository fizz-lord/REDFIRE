from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Target
from app.schemas import TargetCreate, TargetUpdate, TargetOut
from app.crypto import encrypt_value

router = APIRouter(prefix="/api/targets", tags=["targets"])


@router.get("", response_model=list[TargetOut])
async def list_targets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).order_by(Target.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=TargetOut, status_code=201)
async def create_target(data: TargetCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump()
    payload["api_key"] = encrypt_value(payload.get("api_key") or "")
    target = Target(**payload)
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("/{target_id}", response_model=TargetOut)
async def get_target(target_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")
    return target


@router.put("/{target_id}", response_model=TargetOut)
async def update_target(target_id: int, data: TargetUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")
    payload = data.model_dump(exclude_unset=True)
    if "api_key" in payload:
        payload["api_key"] = encrypt_value(payload["api_key"] or "")
    for key, val in payload.items():
        setattr(target, key, val)
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=204)
async def delete_target(target_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")
    await db.delete(target)
    await db.commit()
