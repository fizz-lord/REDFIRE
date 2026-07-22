from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Attack, CampaignAttack, AttackCategory, Severity
from app.schemas import AttackCreate, AttackUpdate, AttackOut
from app.attack_library import BUILTIN_ATTACKS

router = APIRouter(prefix="/api/attacks", tags=["attacks"])


@router.get("", response_model=list[AttackOut])
async def list_attacks(
    category: AttackCategory | None = None,
    severity: Severity | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Attack).order_by(Attack.created_at.desc())
    if category:
        query = query.where(Attack.category == category)
    if severity:
        query = query.where(Attack.severity == severity)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=AttackOut, status_code=201)
async def create_attack(data: AttackCreate, db: AsyncSession = Depends(get_db)):
    attack = Attack(**data.model_dump())
    db.add(attack)
    await db.commit()
    await db.refresh(attack)
    return attack


@router.post("/seed", status_code=201)
async def seed_builtin_attacks(reseed: bool = False, db: AsyncSession = Depends(get_db)):
    """Load the builtin attack library into the database."""
    if not reseed:
        result = await db.execute(select(Attack).limit(1))
        if result.scalar_one_or_none():
            return {"message": "Attacks already seeded. Use reseed=true to reload."}

    if reseed:
        # Delete campaign_attacks first to avoid FK constraint errors
        await db.execute(CampaignAttack.__table__.delete())
        existing = await db.execute(select(Attack))
        for attack in existing.scalars().all():
            await db.delete(attack)
        await db.commit()

    for prompt, category, severity, desc, mitre_id, owasp_id in BUILTIN_ATTACKS:
        attack = Attack(
            prompt=prompt,
            category=category,
            severity=severity,
            description=desc,
            tags=[category.value],
            mitre_atlas_id=mitre_id,
            owasp_llm_id=owasp_id,
        )
        db.add(attack)
    await db.commit()
    return {"message": f"Seeded {len(BUILTIN_ATTACKS)} attacks"}


@router.get("/{attack_id}", response_model=AttackOut)
async def get_attack(attack_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Attack).where(Attack.id == attack_id))
    attack = result.scalar_one_or_none()
    if not attack:
        raise HTTPException(404, "Attack not found")
    return attack


@router.put("/{attack_id}", response_model=AttackOut)
async def update_attack(attack_id: int, data: AttackUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Attack).where(Attack.id == attack_id))
    attack = result.scalar_one_or_none()
    if not attack:
        raise HTTPException(404, "Attack not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(attack, key, val)
    await db.commit()
    await db.refresh(attack)
    return attack


@router.delete("/{attack_id}", status_code=204)
async def delete_attack(attack_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Attack).where(Attack.id == attack_id))
    attack = result.scalar_one_or_none()
    if not attack:
        raise HTTPException(404, "Attack not found")
    # Delete referencing campaign_attacks first to avoid FK constraint errors
    await db.execute(CampaignAttack.__table__.delete().where(CampaignAttack.attack_id == attack_id))
    await db.delete(attack)
    await db.commit()
