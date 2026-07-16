export interface Target {
  id: number
  name: string
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
  model: string
  api_key: string
  endpoint: string
  config_json: Record<string, unknown>
  created_at: string
}

export interface Attack {
  id: number
  prompt: string
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  tags: string[]
  mitre_atlas_id: string
  owasp_llm_id: string
  created_at: string
}

export interface Probe {
  id: number
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  target_id: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface ProbeDetail extends Probe {
  target: Target | null
  attacks: ProbeAttack[]
}

export interface ProbeAttack {
  id: number
  attack_id: number
  order: number
  status: string
  attack: Attack | null
  results: Result[]
}

export interface Result {
  id: number
  campaign_attack_id: number
  response: string
  score: number
  label: string
  refusal_signals: number
  compliance_signals: number
  response_time_ms: number
  details: string
  created_at: string
}

export interface QuickTestLog {
  id: number
  target_id: number
  target_name: string
  model: string
  prompt: string
  fired_prompt: string
  response: string
  score: number
  label: string
  refusal_signals: number
  compliance_signals: number
  details: string
  transform_chain: string[]
  created_at: string
}

export interface DashboardStats {
  total_probes: number
  total_attacks: number
  total_targets: number
  total_results: number
  jailbreak_rate: number
  avg_score: number
  critical_breaches: number
  attacks_by_category: Record<string, number>
  severity_distribution: Record<string, number>
}

export interface ConversationTurn {
  id: number
  order: number
  role: string
  content: string
  score: number
  label: string
  refusal_signals: number
  compliance_signals: number
  details: string
  created_at: string
}

export interface Conversation {
  id: number
  target_id: number
  name: string
  created_at: string
  updated_at: string
  turns: ConversationTurn[]
}

export interface ComparisonResult {
  id: number
  target_id: number
  target_name: string
  model: string
  response: string
  score: number
  label: string
  refusal_signals: number
  compliance_signals: number
  response_time_ms: number
  details: string
  error: string
  created_at: string
}

export interface Comparison {
  id: number
  prompt: string
  created_at: string
  results: ComparisonResult[]
}

export interface ExtractionResult {
  id: number
  technique: string
  prompt: string
  response: string
  extracted: boolean
  confidence: number
  created_at: string
}

export interface ExtractionRun {
  id: number
  target_id: number
  created_at: string
  results: ExtractionResult[]
}

export interface AgentAttack {
  id: number
  round: number
  prompt: string
  response: string
  score: number
  label: string
  refusal_signals: number
  compliance_signals: number
  details: string
  response_time_ms: number
  created_at: string
}

export interface AgentRun {
  id: number
  target_id: number
  attacker_target_id: number | null
  category: string
  rounds: number
  status: string
  summary: string
  created_at: string
  completed_at: string | null
  attacks: AgentAttack[]
}

export interface ReviewItem {
  id: number
  source_table: string
  source_id: number
  prompt: string
  response: string
  score: number
  label: string
  reviewed: boolean
  verdict: string
  notes: string
  created_at: string
}

export interface Report {
  id: number
  name: string
  target_id: number | null
  config_json: string
  summary_json: string
  created_at: string
}

export type AttackCategory =
  | 'jailbreak' | 'prompt_injection' | 'harmful_content'
  | 'pii_extraction' | 'data_extraction' | 'misinformation'
  | 'bias' | 'ethical' | 'system_exploit'
  | 'owasp_llm01_prompt_injection' | 'owasp_llm02_sensitive_disclosure'
  | 'owasp_llm03_training_data' | 'owasp_llm04_denial_of_service'
  | 'owasp_llm05_supply_chain' | 'owasp_llm06_permission_escalation'
  | 'owasp_llm07_agent_hijack' | 'owasp_llm08_excessive_agency'
  | 'owasp_llm09_overreliance' | 'owasp_llm10_model_theft'
  | 'custom'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'custom'
