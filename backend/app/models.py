import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import relationship
import enum

from app.database import Base
from app.crypto import decrypt_value


class AttackCategory(str, enum.Enum):
    JAILBREAK = "jailbreak"
    PROMPT_INJECTION = "prompt_injection"
    HARMFUL_CONTENT = "harmful_content"
    PII_EXTRACTION = "pii_extraction"
    DATA_EXTRACTION = "data_extraction"
    MISINFORMATION = "misinformation"
    BIAS = "bias"
    ETHICAL = "ethical"
    SYSTEM_EXPLOIT = "system_exploit"
    OWASP_LLM01 = "owasp_llm01_prompt_injection"
    OWASP_LLM02 = "owasp_llm02_sensitive_disclosure"
    OWASP_LLM03 = "owasp_llm03_training_data"
    OWASP_LLM04 = "owasp_llm04_denial_of_service"
    OWASP_LLM05 = "owasp_llm05_supply_chain"
    OWASP_LLM06 = "owasp_llm06_permission_escalation"
    OWASP_LLM07 = "owasp_llm07_agent_hijack"
    OWASP_LLM08 = "owasp_llm08_excessive_agency"
    OWASP_LLM09 = "owasp_llm09_overreliance"
    OWASP_LLM10 = "owasp_llm10_model_theft"
    HALLUCINATION = "hallucination"
    REFUSAL_BYPASS = "refusal_bypass"
    CUSTOM = "custom"


class Severity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ProviderType(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    CUSTOM = "custom"


class CampaignStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Target(Base):
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    provider = Column(SAEnum(ProviderType), nullable=False)
    model = Column(String(100), nullable=False)
    api_key = Column(String(500), default="")
    endpoint = Column(String(500), default="")
    config_json = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))

    campaigns = relationship("Campaign", back_populates="target")

    @property
    def decrypted_api_key(self) -> str:
        return decrypt_value(self.api_key)


class Attack(Base):
    __tablename__ = "attacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt = Column(Text, nullable=False)
    category = Column(SAEnum(AttackCategory), nullable=False, index=True)
    severity = Column(SAEnum(Severity), nullable=False)
    description = Column(Text, default="")
    tags = Column(JSON, default=[])
    mitre_atlas_id = Column(String(50), default="")
    owasp_llm_id = Column(String(50), default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    campaign_attacks = relationship("CampaignAttack", back_populates="attack")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.PENDING)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    target = relationship("Target", back_populates="campaigns")
    campaign_attacks = relationship("CampaignAttack", back_populates="campaign", cascade="all, delete-orphan")

    @property
    def attacks(self):
        return self.campaign_attacks


class CampaignAttack(Base):
    __tablename__ = "campaign_attacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    attack_id = Column(Integer, ForeignKey("attacks.id"), nullable=False)
    order = Column(Integer, default=0)
    status = Column(String(20), default="pending")

    campaign = relationship("Campaign", back_populates="campaign_attacks")
    attack = relationship("Attack", back_populates="campaign_attacks")
    results = relationship("Result", back_populates="campaign_attack", cascade="all, delete-orphan")


class QuickTestLog(Base):
    __tablename__ = "quick_test_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, nullable=False)
    target_name = Column(String(200), default="")
    model = Column(String(100), default="")
    prompt = Column(Text, default="")
    fired_prompt = Column(Text, default="")
    response = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    refusal_signals = Column(Integer, default=0)
    compliance_signals = Column(Integer, default=0)
    details = Column(Text, default="")
    transform_chain = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_attack_id = Column(Integer, ForeignKey("campaign_attacks.id"), nullable=False)
    response = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    refusal_signals = Column(Integer, default=0)
    compliance_signals = Column(Integer, default=0)
    response_time_ms = Column(Float, default=0.0)
    details = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    campaign_attack = relationship("CampaignAttack", back_populates="results")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    name = Column(String(200), default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc), onupdate=datetime.datetime.now(datetime.timezone.utc))

    target = relationship("Target")
    turns = relationship("ConversationTurn", back_populates="conversation", cascade="all, delete-orphan", order_by="ConversationTurn.order")


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    order = Column(Integer, default=0)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    refusal_signals = Column(Integer, default=0)
    compliance_signals = Column(Integer, default=0)
    details = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    conversation = relationship("Conversation", back_populates="turns")


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    results = relationship("ComparisonResult", back_populates="comparison", cascade="all, delete-orphan")


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comparison_id = Column(Integer, ForeignKey("comparisons.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    target_name = Column(String(200), default="")
    model = Column(String(100), default="")
    response = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    refusal_signals = Column(Integer, default=0)
    compliance_signals = Column(Integer, default=0)
    response_time_ms = Column(Float, default=0.0)
    details = Column(Text, default="")
    error = Column(String(500), default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    comparison = relationship("Comparison", back_populates="results")
    target = relationship("Target")


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    target = relationship("Target")
    results = relationship("ExtractionResult", back_populates="run", cascade="all, delete-orphan")


class ExtractionResult(Base):
    __tablename__ = "extraction_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("extraction_runs.id"), nullable=False)
    technique = Column(String(100), default="")
    prompt = Column(Text, nullable=False)
    response = Column(Text, default="")
    extracted = Column(Boolean, default=False)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    run = relationship("ExtractionRun", back_populates="results")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    attacker_target_id = Column(Integer, ForeignKey("targets.id"), nullable=True)
    category = Column(String(50), default="jailbreak")
    rounds = Column(Integer, default=5)
    status = Column(String(20), default="running")
    summary = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    target = relationship("Target", foreign_keys=[target_id])
    attacker_target = relationship("Target", foreign_keys=[attacker_target_id])
    attacks = relationship("AgentAttack", back_populates="run", cascade="all, delete-orphan", order_by="AgentAttack.round")


class AgentAttack(Base):
    __tablename__ = "agent_attacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("agent_runs.id"), nullable=False)
    round = Column(Integer, default=1)
    prompt = Column(Text, nullable=False)
    response = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    refusal_signals = Column(Integer, default=0)
    compliance_signals = Column(Integer, default=0)
    details = Column(Text, default="")
    response_time_ms = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    run = relationship("AgentRun", back_populates="attacks")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=True)
    config_json = Column(Text, default="{}")
    summary_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_table = Column(String(50), nullable=False)  # "quick_test_logs", "comparison_results", "agent_attacks", "extraction_results"
    source_id = Column(Integer, nullable=False)
    prompt = Column(Text, default="")
    response = Column(Text, default="")
    score = Column(Float, default=0.0)
    label = Column(String(50), default="")
    reviewed = Column(Boolean, default=False)
    verdict = Column(String(50), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
