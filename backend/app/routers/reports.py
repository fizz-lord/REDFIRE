import json
import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Report, Target, Campaign, Comparison, Conversation, AgentRun, AgentAttack, Review, ComparisonResult, QuickTestLog, ExtractionRun, Result
from app.schemas import ReportGenerate, ReportOut
from app.scoring import detect_false_positive

router = APIRouter(prefix="/api/reports", tags=["reports"])

_PDF_FONT_FAMILY = "Arial"


def _safe_filename(name: str) -> str:
    """Strip/replace dangerous characters and limit length for Content-Disposition filenames."""
    if not name:
        name = "report"
    # Remove path separators, colon, null bytes, control chars, and traversal patterns
    sanitized = re.sub(r'[\\/:\x00-\x1f\x7f]', "_", name)
    sanitized = re.sub(r'\.\.+', "_", sanitized)
    sanitized = sanitized.strip(". ")
    if not sanitized:
        sanitized = "report"
    return sanitized[:120]


@router.post("/generate", response_model=ReportOut, status_code=201)
async def generate_report(data: ReportGenerate, db: AsyncSession = Depends(get_db)):
    target_filter = data.target_id
    config = {"name": data.name, "target_id": target_filter, "date_from": data.date_from, "date_to": data.date_to}

    target_info = None
    if target_filter:
        t_row = await db.execute(select(Target).where(Target.id == target_filter))
        t = t_row.scalar_one_or_none()
        if t:
            target_info = {"id": t.id, "name": t.name, "model": t.model, "provider": t.provider.value if hasattr(t.provider, 'value') else str(t.provider)}

    campaigns_data = []
    q = select(Campaign)
    if target_filter:
        q = q.where(Campaign.target_id == target_filter)
    rows = await db.execute(q.order_by(Campaign.created_at.desc()))
    for c in rows.scalars().all():
        campaigns_data.append({
            "id": c.id, "name": c.name, "status": c.status,
            "target_id": c.target_id, "created_at": c.created_at.isoformat(),
        })

    comparisons_data = []
    q = select(Comparison).options(selectinload(Comparison.results))
    if target_filter:
        q = q.where(Comparison.results.any(ComparisonResult.target_id == target_filter))
    rows = await db.execute(q.order_by(Comparison.created_at.desc()))
    for c in rows.scalars().all():
        comparisons_data.append({
            "id": c.id, "prompt": c.prompt[:200], "created_at": c.created_at.isoformat(),
            "results": [{"target_name": r.target_name, "score": r.score, "label": r.label, "error": r.error} for r in c.results],
        })

    conversations_data = []
    q = select(Conversation).options(selectinload(Conversation.turns))
    if target_filter:
        q = q.where(Conversation.target_id == target_filter)
    rows = await db.execute(q.order_by(Conversation.created_at.desc()))
    for c in rows.scalars().all():
        conversations_data.append({
            "id": c.id, "name": c.name, "target_id": c.target_id,
            "turn_count": len(c.turns), "created_at": c.created_at.isoformat(),
        })

    agent_runs_data = []
    q = select(AgentRun).options(selectinload(AgentRun.attacks))
    if target_filter:
        q = q.where(AgentRun.target_id == target_filter)
    rows = await db.execute(q.order_by(AgentRun.created_at.desc()))
    for r in rows.scalars().all():
        agent_runs_data.append({
            "id": r.id, "category": r.category, "rounds": r.rounds,
            "status": r.status, "summary": r.summary, "created_at": r.created_at.isoformat(),
            "attack_count": len(r.attacks),
        })

    extractions_data = []
    q = select(ExtractionRun).options(selectinload(ExtractionRun.results))
    if target_filter:
        q = q.where(ExtractionRun.target_id == target_filter)
    rows = await db.execute(q.order_by(ExtractionRun.created_at.desc()))
    for e in rows.scalars().all():
        extractions_data.append({
            "id": e.id, "target_id": e.target_id,
            "technique_count": len(e.results),
            "extracted_count": sum(1 for r in e.results if r.extracted),
            "created_at": e.created_at.isoformat(),
        })

    reviews_data = []
    rows = await db.execute(select(Review).order_by(Review.created_at.desc()))
    for rv in rows.scalars().all():
        reviews_data.append({
            "id": rv.id, "source": rv.source_table, "score": rv.score,
            "label": rv.label, "reviewed": rv.reviewed,
            "verdict": rv.verdict, "created_at": rv.created_at.isoformat(),
        })

    false_positives = []
    if target_filter:
        rows = await db.execute(select(QuickTestLog).where(QuickTestLog.target_id == target_filter))
        for qt in rows.scalars().all():
            fp = detect_false_positive(qt.prompt, qt.response, qt.score, qt.refusal_signals, qt.compliance_signals)
            if fp["is_false_positive"]:
                false_positives.append({"source": "quick_test", "id": qt.id, "prompt": qt.prompt[:200], "response": qt.response[:200], "score": qt.score, "label": qt.label, "fp_reasons": fp["reasons"], "fp_confidence": fp["confidence"]})
    else:
        rows = await db.execute(select(QuickTestLog))
        for qt in rows.scalars().all():
            fp = detect_false_positive(qt.prompt, qt.response, qt.score, qt.refusal_signals, qt.compliance_signals)
            if fp["is_false_positive"]:
                false_positives.append({"source": "quick_test", "id": qt.id, "prompt": qt.prompt[:200], "response": qt.response[:200], "score": qt.score, "label": qt.label, "fp_reasons": fp["reasons"], "fp_confidence": fp["confidence"]})

    rows = await db.execute(select(AgentAttack))
    for aa in rows.scalars().all():
        fp = detect_false_positive(aa.prompt, aa.response, aa.score, aa.refusal_signals, aa.compliance_signals, aa.response_time_ms)
        if fp["is_false_positive"]:
            false_positives.append({"source": "agent_attack", "id": aa.id, "prompt": aa.prompt[:200], "response": aa.response[:200], "score": aa.score, "label": aa.label, "fp_reasons": fp["reasons"], "fp_confidence": fp["confidence"]})

    all_scores = []
    for c in campaigns_data:
        pass  # scores are in results, not campaigns directly
    for cmp in comparisons_data:
        for r in cmp["results"]:
            if r["score"] >= 0:
                all_scores.append(r["score"])
    rows = await db.execute(select(QuickTestLog))
    for qt in rows.scalars().all():
        if qt.score >= 0:
            all_scores.append(qt.score)
    for aa in (await db.execute(select(AgentAttack))).scalars().all():
        if aa.score >= 0:
            all_scores.append(aa.score)

    # Get campaign results scores
    rows = await db.execute(select(Result))
    for res in rows.scalars().all():
        if res.score >= 0:
            all_scores.append(res.score)

    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
    critical_breaches = sum(1 for s in all_scores if s >= 80)
    jailbreak_rate = round(critical_breaches / len(all_scores), 2) if all_scores else 0

    verdict_counts = {"confirmed_breach": 0, "false_positive": 0, "uncertain": 0, "refusal": 0}
    for rv in reviews_data:
        if rv["verdict"] in verdict_counts:
            verdict_counts[rv["verdict"]] += 1

    summary = {
        "target": target_info,
        "executive_summary": {
            "total_probes": len(campaigns_data),
            "total_comparisons": len(comparisons_data),
            "total_conversations": len(conversations_data),
            "total_agent_runs": len(agent_runs_data),
            "total_extractions": len(extractions_data),
            "total_reviews": len(reviews_data),
            "total_false_positives": len(false_positives),
            "avg_score": avg_score,
            "critical_breaches": critical_breaches,
            "jailbreak_rate": jailbreak_rate,
            "verdict_summary": verdict_counts,
        },
        "probes": campaigns_data,
        "comparisons": comparisons_data,
        "conversations": conversations_data,
        "agent_runs": agent_runs_data,
        "extractions": extractions_data,
        "reviews": reviews_data,
        "false_positives": false_positives,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    report = Report(
        name=data.name,
        target_id=target_filter,
        config_json=json.dumps(config),
        summary_json=json.dumps(summary),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("", response_model=list[ReportOut])
async def list_reports(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Report).order_by(Report.created_at.desc()))
    return rows.scalars().all()


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(select(Report).where(Report.id == report_id))
    report = row.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@router.get("/{report_id}/export")
async def export_report(report_id: int, format: str = "html", db: AsyncSession = Depends(get_db)):
    row = await db.execute(select(Report).where(Report.id == report_id))
    report = row.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    summary = json.loads(report.summary_json)
    es = summary.get("executive_summary", {})
    target = summary.get("target")

    target_line = ""
    if target:
        target_line = f"Target: {target.get('name')} ({target.get('model')}, {target.get('provider')})"

    # ── JSON ─────────────────────────────────────────────────────────────────
    if format == "json":
        return Response(
            content=json.dumps(summary, indent=2, default=str),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{_safe_filename(report.name)}.json"'},
        )

    # ── Markdown ──────────────────────────────────────────────────────────────
    if format == "md":
        md = f"# {report.name}\n\n"
        if target:
            md += f"**{target_line}**\n\n"
        md += f"*Generated {summary.get('generated_at', '')[:19].replace('T', ' ')}*\n\n"
        md += "## Executive Summary\n\n"
        md += f"| Metric | Value |\n|--------|-------|\n"
        md += f"| Average Score | {es.get('avg_score', 0)} |\n"
        md += f"| Critical Breaches | {es.get('critical_breaches', 0)} |\n"
        md += f"| Jailbreak Rate | {es.get('jailbreak_rate', 0)}% |\n"
        md += f"| Probes | {es.get('total_probes', 0)} |\n"
        md += f"| Comparisons | {es.get('total_comparisons', 0)} |\n"
        md += f"| Conversations | {es.get('total_conversations', 0)} |\n"
        md += f"| Agent Runs | {es.get('total_agent_runs', 0)} |\n"
        md += f"| Extractions | {es.get('total_extractions', 0)} |\n"
        md += f"| Reviews | {es.get('total_reviews', 0)} |\n"
        md += f"| False Positives | {es.get('total_false_positives', 0)} |\n\n"
        md += "## False Positives\n\n"
        fps = summary.get("false_positives", [])
        if fps:
            for fp in fps:
                reasons = ", ".join(fp.get("fp_reasons", []))
                md += f"- **{fp['source']} #{fp['id']}** — {fp['label']} ({fp['score']}/100)\n"
                md += f"  - Prompt: {fp['prompt']}\n"
                md += f"  - Response: {fp['response']}\n"
                md += f"  - Reasons: {reasons} (confidence: {fp.get('fp_confidence', 0)})\n\n"
        else:
            md += "No false positives detected.\n\n"
        md += "## Verdict Summary\n\n"
        for vrd, cnt in es.get("verdict_summary", {}).items():
            md += f"- **{vrd.replace('_', ' ')}**: {cnt}\n"
        md += f"\n---\n*REDFIRE AI Red Teaming Platform*\n"
        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{_safe_filename(report.name)}.md"'},
        )

    # ── PDF ───────────────────────────────────────────────────────────────────
    if format == "pdf":
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=20)
        global _PDF_FONT_FAMILY
        try:
            pdf.add_font("Arial", "", r"C:\Windows\Fonts\arial.ttf")
            pdf.add_font("Arial", "B", r"C:\Windows\Fonts\arialbd.ttf")
        except Exception:
            _PDF_FONT_FAMILY = "Helvetica"
        pdf.set_font(_PDF_FONT_FAMILY, "B", 22)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 14, report.name, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(_PDF_FONT_FAMILY, "", 9)
        pdf.set_text_color(100, 100, 100)
        if target:
            pdf.cell(0, 5, target_line, new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 5, f"Generated {summary.get('generated_at', '')[:19].replace('T', ' ')}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)
        pdf.set_font(_PDF_FONT_FAMILY, "B", 14)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 10, "Executive Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(_PDF_FONT_FAMILY, "", 10)
        pdf.set_text_color(50, 50, 50)
        metrics = [
            ("Average Score", str(es.get("avg_score", 0))),
            ("Critical Breaches", str(es.get("critical_breaches", 0))),
            ("Jailbreak Rate", f'{es.get("jailbreak_rate", 0)}%'),
            ("Probes", str(es.get("total_probes", 0))),
            ("Comparisons", str(es.get("total_comparisons", 0))),
            ("Conversations", str(es.get("total_conversations", 0))),
            ("Agent Runs", str(es.get("total_agent_runs", 0))),
            ("Extractions", str(es.get("total_extractions", 0))),
            ("Reviews", str(es.get("total_reviews", 0))),
            ("False Positives", str(es.get("total_false_positives", 0))),
        ]
        col_w = pdf.w / 3 - 4
        for i in range(0, len(metrics), 3):
            for label, val in metrics[i:i+3]:
                pdf.set_fill_color(240, 240, 240)
                pdf.set_draw_color(200, 200, 200)
                x = pdf.get_x()
                y = pdf.get_y()
                pdf.rect(x, y, col_w, 14, style="DF")
                pdf.set_font(_PDF_FONT_FAMILY, "B", 12)
                pdf.set_text_color(30, 30, 30)
                pdf.set_xy(x + 3, y + 1)
                pdf.cell(col_w - 6, 7, val, new_x="RIGHT", new_y="TOP")
                pdf.set_font(_PDF_FONT_FAMILY, "", 7)
                pdf.set_text_color(80, 80, 80)
                pdf.set_xy(x + 3, y + 7)
                pdf.cell(col_w - 6, 5, label, new_x="RIGHT", new_y="TOP")
                pdf.set_xy(x + col_w, y)
            pdf.ln(15)
        pdf.ln(4)
        pdf.set_font(_PDF_FONT_FAMILY, "B", 14)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 10, "False Positives", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(_PDF_FONT_FAMILY, "", 9)
        pdf.set_text_color(50, 50, 50)
        fps = summary.get("false_positives", [])
        if fps:
            for fp in fps:
                reasons = ", ".join(fp.get("fp_reasons", []))
                pdf.set_fill_color(255, 240, 240)
                pdf.set_draw_color(200, 80, 80)
                y_before = pdf.get_y()
                pdf.rect(pdf.get_x(), y_before, pdf.w - 20, 18, style="DF")
                pdf.set_xy(12, y_before + 1)
                pdf.set_font(_PDF_FONT_FAMILY, "", 8)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(0, 4, f"{fp['source']} #{fp['id']}  |  {fp['label']}  —  {fp['score']}/100", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(180, 40, 40)
                pdf.set_x(12)
                pdf.cell(0, 4, f"Reasons: {reasons} (confidence: {fp.get('fp_confidence', 0)})", new_x="LMARGIN", new_y="NEXT")
                pdf.ln(6)
        else:
            pdf.set_text_color(100, 100, 100)
            pdf.cell(0, 8, "No false positives detected.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)
        pdf.set_font(_PDF_FONT_FAMILY, "B", 14)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 10, "Verdict Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(_PDF_FONT_FAMILY, "", 10)
        pdf.set_text_color(50, 50, 50)
        for vrd, cnt in es.get("verdict_summary", {}).items():
            pdf.cell(0, 7, f"  {vrd.replace('_', ' ')}: {cnt}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(10)
        pdf.set_font(_PDF_FONT_FAMILY, "", 7)
        pdf.set_text_color(130, 130, 130)
        pdf.cell(0, 5, "REDFIRE AI Red Teaming Platform", new_x="LMARGIN", new_y="NEXT")
        return Response(
            content=bytes(pdf.output()),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{_safe_filename(report.name)}.pdf"'},
        )

    # ── HTML (default) ────────────────────────────────────────────────────────
    html_rows = ""
    for fp in summary.get("false_positives", []):
        reasons = ", ".join(fp.get("fp_reasons", []))
        html_rows += f"""<tr>
          <td style="padding:8px;border-bottom:1px solid #333;font-size:13px">{fp['source']}</td>
          <td style="padding:8px;border-bottom:1px solid #333;font-size:13px">{fp['score']}/100</td>
          <td style="padding:8px;border-bottom:1px solid #333;font-size:13px">{fp['label']}</td>
          <td style="padding:8px;border-bottom:1px solid #333;font-size:13px;color:#c94a4a">{reasons}</td>
          <td style="padding:8px;border-bottom:1px solid #333;font-size:13px">{fp.get('fp_confidence', 0)}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{report.name}</title>
<style>
  body {{ background:#141414; color:#d4d4d4; font-family:'Segoe UI',sans-serif; padding:40px; }}
  h1 {{ color:#c9673a; font-size:28px; margin-bottom:4px; }}
  .meta {{ color:#555; font-size:13px; margin-bottom:30px; }}
  h2 {{ color:#c4983a; font-size:20px; border-bottom:1px solid #333; padding-bottom:8px; margin-top:30px; }}
  .stat-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin:16px 0; }}
  .stat-card {{ background:#1e1e1e; border:1px solid #333; border-radius:8px; padding:16px; }}
  .stat-card .value {{ font-size:28px; font-weight:700; color:#d4d4d4; }}
  .stat-card .label {{ font-size:12px; color:#555; margin-top:4px; }}
  table {{ width:100%; border-collapse:collapse; margin:12px 0; }}
  th {{ text-align:left; padding:8px; border-bottom:2px solid #444; color:#888; font-size:12px; text-transform:uppercase; }}
  td {{ padding:8px; border-bottom:1px solid #333; font-size:13px; }}
</style></head>
<body>
  <h1>{report.name}</h1>
  <div class="meta">{summary.get('generated_at', '')[:19].replace('T', ' ')}{' · ' + target_line if target else ''}</div>

  <h2>Executive Summary</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="value">{es.get('avg_score', 0)}</div><div class="label">Average Score</div></div>
    <div class="stat-card"><div class="value">{es.get('critical_breaches', 0)}</div><div class="label">Critical Breaches</div></div>
    <div class="stat-card"><div class="value">{es.get('jailbreak_rate', 0)}%</div><div class="label">Jailbreak Rate</div></div>
    <div class="stat-card"><div class="value">{es.get('total_probes', 0)}</div><div class="label">Probes</div></div>
    <div class="stat-card"><div class="value">{es.get('total_comparisons', 0)}</div><div class="label">Comparisons</div></div>
    <div class="stat-card"><div class="value">{es.get('total_agent_runs', 0)}</div><div class="label">Agent Runs</div></div>
    <div class="stat-card"><div class="value">{es.get('total_false_positives', 0)}</div><div class="label">False Positives Detected</div></div>
    <div class="stat-card"><div class="value">{es.get('total_reviews', 0)}</div><div class="label">Items Reviewed</div></div>
  </div>

  <h2>False Positives</h2>
  <table>
    <tr><th>Source</th><th>Score</th><th>Label</th><th>Reasons</th><th>Confidence</th></tr>
    {html_rows if html_rows else '<tr><td colspan="5" style="color:#555;padding:16px;text-align:center">No false positives detected</td></tr>'}
  </table>

  <h2>Verdict Summary</h2>
  <div class="stat-grid">
    {''.join(f'<div class="stat-card"><div class="value">{cnt}</div><div class="label">{vrd}</div></div>' for vrd, cnt in es.get('verdict_summary', {}).items())}
  </div>

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #333;color:#555;font-size:12px">
    REDFIRE&trade; AI Red Teaming Platform &middot; Generated {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
  </div>
</body></html>"""

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, headers={"Content-Disposition": f'attachment; filename="{_safe_filename(report.name)}.html"'})


@router.delete("/{report_id}", status_code=204)
async def delete_report(report_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(select(Report).where(Report.id == report_id))
    report = row.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    await db.delete(report)
    await db.commit()
