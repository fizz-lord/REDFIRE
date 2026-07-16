from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Result, Campaign, CampaignAttack, Attack, CampaignStatus, QuickTestLog, AgentRun
from app.schemas import ResultOut, DashboardStats, QuickTestRequest, QuickTestResult, QuickTestLogOut
from app.providers import call_provider, ProviderType
from app.scoring import score_response
from app.transforms import apply_chain

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/results", response_model=list[ResultOut])
async def list_results(probe_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Result).order_by(Result.created_at.desc())
    if probe_id:
        query = (
            select(Result)
            .join(CampaignAttack)
            .where(CampaignAttack.campaign_id == probe_id)
            .order_by(Result.created_at.desc())
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_probes = (await db.execute(select(func.count(Campaign.id)))).scalar() or 0
    total_attacks = (await db.execute(select(func.count(Attack.id)))).scalar() or 0
    total_targets = (await db.execute(select(func.count(Campaign.target_id.distinct())))).scalar() or 0
    total_results = (await db.execute(select(func.count(Result.id)))).scalar() or 0

    results_data = await db.execute(select(Result.score, Result.label))
    rows = results_data.all()
    scores = [r[0] for r in rows if r[0] >= 0]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    jailbroken = sum(1 for r in rows if r[1] == "JAILBROKEN")
    jailbreak_rate = (jailbroken / len(rows) * 100) if rows else 0.0
    critical_breaches = sum(1 for r in rows if r[0] >= 80)

    cats = await db.execute(
        select(Attack.category, func.count(Attack.id))
        .group_by(Attack.category)
    )
    attacks_by_category = {str(k): v for k, v in cats.all()}

    sevs = await db.execute(
        select(Attack.severity, func.count(Attack.id))
        .group_by(Attack.severity)
    )
    severity_distribution = {str(k): v for k, v in sevs.all()}

    # Also check quick test logs and results for severity/score distribution
    qt_sevs = await db.execute(
        select(QuickTestLog.label, func.count(QuickTestLog.id))
        .group_by(QuickTestLog.label)
    )
    for k, v in qt_sevs.all():
        key = f"qt_{k}" if k else "qt_unknown"
        severity_distribution[key] = v

    return DashboardStats(
        total_probes=total_probes,
        total_attacks=total_attacks,
        total_targets=total_targets,
        total_results=total_results,
        jailbreak_rate=jailbreak_rate,
        avg_score=avg_score,
        critical_breaches=critical_breaches,
        attacks_by_category=attacks_by_category,
        severity_distribution=severity_distribution,
    )


@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    running_probes = (await db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.RUNNING))).scalar() or 0
    running_agents = (await db.execute(select(func.count(AgentRun.id)).where(AgentRun.status == "running"))).scalar() or 0
    is_running = (running_probes + running_agents) > 0
    return {"running": is_running, "probes": running_probes, "agents": running_agents}


@router.get("/quick-test-logs", response_model=list[QuickTestLogOut])
async def list_quick_test_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(QuickTestLog).order_by(QuickTestLog.created_at.desc()).limit(limit))
    return result.scalars().all()


@router.get("/quick-test-logs/{log_id}", response_model=QuickTestLogOut)
async def get_quick_test_log(log_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(QuickTestLog).where(QuickTestLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(404, "Log not found")
    return log


@router.post("/quick-test", response_model=QuickTestResult)
async def quick_test(data: QuickTestRequest, db: AsyncSession = Depends(get_db)):
    from app.models import Target
    target_result = await db.execute(select(Target).where(Target.id == data.target_id))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")

    response = await call_provider(
        target.provider, data.prompt,
        target.api_key or "", target.model, target.endpoint or "",
    )

    if not response:
        raise HTTPException(502, "Provider returned no response")

    transform_chain = data.transforms or []
    fired_prompt = data.prompt
    if transform_chain:
        fired_prompt = apply_chain(data.prompt, transform_chain)
        response = await call_provider(target.provider, fired_prompt, target.api_key or "", target.model, target.endpoint or "")
        if not response:
            raise HTTPException(502, "Provider returned no response for transformed prompt")

    sd = score_response(fired_prompt, response, data.severity)

    log_entry = QuickTestLog(
        target_id=target.id,
        target_name=target.name,
        model=target.model,
        prompt=data.prompt,
        fired_prompt=fired_prompt,
        response=response,
        score=sd["score"],
        label=sd["label"],
        refusal_signals=sd["refusal_signals"],
        compliance_signals=sd["compliance_signals"],
        details=sd["detail"],
        transform_chain=transform_chain,
    )
    db.add(log_entry)
    await db.commit()

    return QuickTestResult(
        response=response,
        score=sd["score"],
        label=sd["label"],
        refusal_signals=sd["refusal_signals"],
        compliance_signals=sd["compliance_signals"],
        details=sd["detail"],
        transform_chain=transform_chain,
    )
