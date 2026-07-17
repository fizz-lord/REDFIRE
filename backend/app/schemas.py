import datetime
from typing import Optional, Annotated
from pydantic import BaseModel, Field
from pydantic.functional_serializers import PlainSerializer

from app.models import AttackCategory, Severity, ProviderType, CampaignStatus

def _with_tz(dt: UTCDatetime) -> str:
    if dt.tzinfo is None:
        return dt.isoformat() + "+00:00"
    return dt.isoformat()

UTCDatetime = Annotated[datetime.datetime, PlainSerializer(_with_tz)]


# ── Target ────────────────────────────────────────────────────────────────

class TargetCreate(BaseModel):
    name: str = Field(..., max_length=200)
    provider: ProviderType
    model: str = Field(..., max_length=200)
    api_key: str = Field("", max_length=2000)
    endpoint: str = Field("", max_length=2000)
    config_json: dict = {}


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[ProviderType] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    config_json: Optional[dict] = None


class TargetOut(BaseModel):
    id: int
    name: str
    provider: ProviderType
    model: str
    api_key: str = ""
    endpoint: str = ""
    config_json: dict = {}
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


# ── Attack ────────────────────────────────────────────────────────────────

class AttackCreate(BaseModel):
    prompt: str = Field(..., max_length=8000)
    category: AttackCategory
    severity: Severity
    description: str = Field("", max_length=2000)
    tags: list[str] = []
    mitre_atlas_id: str = Field("", max_length=100)
    owasp_llm_id: str = Field("", max_length=100)


class AttackUpdate(BaseModel):
    prompt: Optional[str] = None
    category: Optional[AttackCategory] = None
    severity: Optional[Severity] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    mitre_atlas_id: Optional[str] = None
    owasp_llm_id: Optional[str] = None


class AttackOut(BaseModel):
    id: int
    prompt: str
    category: AttackCategory
    severity: Severity
    description: str
    tags: list[str]
    mitre_atlas_id: str
    owasp_llm_id: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


# ── Campaign ──────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    target_id: int
    attack_ids: list[int] = []


class CampaignOut(BaseModel):
    id: int
    name: str
    description: str
    status: CampaignStatus
    target_id: int
    created_at: UTCDatetime
    started_at: Optional[UTCDatetime] = None
    completed_at: Optional[UTCDatetime] = None

    model_config = {"from_attributes": True}


class CampaignDetail(CampaignOut):
    target: Optional[TargetOut] = None
    attacks: list["CampaignAttackOut"] = []


class CampaignAttackOut(BaseModel):
    id: int
    attack_id: int
    order: int
    status: str
    attack: Optional[AttackOut] = None
    results: list["ResultOut"] = []

    model_config = {"from_attributes": True}


# ── Result ────────────────────────────────────────────────────────────────

class ResultOut(BaseModel):
    id: int
    campaign_attack_id: int
    response: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    response_time_ms: float
    details: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


# ── Quick Test (single prompt, no campaign) ───────────────────────────────

class QuickTestRequest(BaseModel):
    prompt: str = Field(..., max_length=8000)
    target_id: int
    category: AttackCategory = AttackCategory.CUSTOM
    severity: Severity = Severity.MEDIUM
    transforms: list[str] = []


class QuickTestResult(BaseModel):
    response: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    details: str
    transform_chain: list[str] = []


# ── Transforms ────────────────────────────────────────────────────────────

class TransformInfo(BaseModel):
    name: str
    categories: list[str]


class TransformChainRequest(BaseModel):
    prompt: str
    transforms: list[str]


class TransformChainResult(BaseModel):
    original: str
    transformed: str
    chain: list[str]


# ── Quick Test Log ───────────────────────────────────────────────────────────

class QuickTestLogOut(BaseModel):
    id: int
    target_id: int
    target_name: str
    model: str
    prompt: str
    fired_prompt: str
    response: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    details: str
    transform_chain: list[str] = []
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


# ── Conversations ───────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    target_id: int
    name: str = ""


class ConversationTurnOut(BaseModel):
    id: int
    order: int
    role: str
    content: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    details: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    target_id: int
    name: str
    created_at: UTCDatetime
    updated_at: UTCDatetime
    turns: list[ConversationTurnOut] = []

    model_config = {"from_attributes": True}


class ConversationMessage(BaseModel):
    content: str = Field(..., max_length=8000)


# ── Comparisons ───────────────────────────────────────────────────────────

class ComparisonResultOut(BaseModel):
    id: int
    target_id: int
    target_name: str
    model: str
    response: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    response_time_ms: float
    details: str
    error: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class ComparisonOut(BaseModel):
    id: int
    prompt: str
    created_at: UTCDatetime
    results: list[ComparisonResultOut] = []

    model_config = {"from_attributes": True}


class ComparisonCreate(BaseModel):
    prompt: str = Field(..., max_length=8000)
    target_ids: list[int]


# ── Extraction (system prompt) ────────────────────────────────────────────

class ExtractionResultOut(BaseModel):
    id: int
    technique: str
    prompt: str
    response: str
    extracted: bool
    confidence: float
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class ExtractionRunOut(BaseModel):
    id: int
    target_id: int
    created_at: UTCDatetime
    results: list[ExtractionResultOut] = []

    model_config = {"from_attributes": True}


class ExtractionRunCreate(BaseModel):
    target_id: int


# ── Human Review ─────────────────────────────────────────────────────────

class ReviewOut(BaseModel):
    id: int
    source_table: str
    source_id: int
    prompt: str
    response: str
    score: float
    label: str
    reviewed: bool
    verdict: str
    notes: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class ReviewUpdate(BaseModel):
    verdict: str = ""
    notes: str = ""


# ── Automated Agent ──────────────────────────────────────────────────────

class AgentAttackOut(BaseModel):
    id: int
    round: int
    prompt: str
    response: str
    score: float
    label: str
    refusal_signals: int
    compliance_signals: int
    details: str
    response_time_ms: float
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class AgentRunOut(BaseModel):
    id: int
    target_id: int
    attacker_target_id: Optional[int] = None
    category: str
    rounds: int
    status: str
    summary: str
    created_at: UTCDatetime
    completed_at: Optional[UTCDatetime] = None
    attacks: list[AgentAttackOut] = []

    model_config = {"from_attributes": True}


class AgentRunCreate(BaseModel):
    target_id: int
    category: str = "jailbreak"
    rounds: int = 5
    attacker_target_id: Optional[int] = None


# ── Reports ────────────────────────────────────────────────────────────────

class ReportGenerate(BaseModel):
    name: str
    target_id: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class ReportOut(BaseModel):
    id: int
    name: str
    target_id: Optional[int] = None
    config_json: str
    summary_json: str
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


# ── Stats ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_probes: int
    total_attacks: int
    total_targets: int
    total_results: int
    jailbreak_rate: float
    avg_score: float
    critical_breaches: int
    attacks_by_category: dict[str, int]
    severity_distribution: dict[str, int] = {}
