import type {
  Target, Attack, Probe, ProbeDetail, Result,
  DashboardStats, QuickTestLog,
  Conversation, Comparison, ExtractionRun, AgentRun, ReviewItem, Report,
} from '../types'

const BASE = '/api'

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`(${res.status}) ${err}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Targets ──────────────────────────────────────────────────────────────
export const targets = {
  list: () => req<Target[]>('/targets'),
  get: (id: number) => req<Target>(`/targets/${id}`),
  create: (d: Partial<Target>) => req<Target>('/targets', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: number, d: Partial<Target>) => req<Target>(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: number) => req<void>(`/targets/${id}`, { method: 'DELETE' }),
}

// ── Attacks ──────────────────────────────────────────────────────────────
export const attacks = {
  list: (params?: { category?: string; severity?: string }) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.severity) q.set('severity', params.severity)
    const qs = q.toString()
    return req<Attack[]>(`/attacks${qs ? `?${qs}` : ''}`)
  },
  get: (id: number) => req<Attack>(`/attacks/${id}`),
  create: (d: Partial<Attack>) => req<Attack>('/attacks', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: number, d: Partial<Attack>) => req<Attack>(`/attacks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: number) => req<void>(`/attacks/${id}`, { method: 'DELETE' }),
  seed: (reseed = false) => req<{ message: string }>(`/attacks/seed?reseed=${reseed}`, { method: 'POST' }),
}

// ── Probes ───────────────────────────────────────────────────────────────
export const probes = {
  list: () => req<Probe[]>('/probes'),
  get: (id: number) => req<ProbeDetail>(`/probes/${id}`),
  create: (d: { name: string; description?: string; target_id: number; attack_ids: number[] }) =>
    req<Probe>('/probes', { method: 'POST', body: JSON.stringify(d) }),
  run: (id: number) => req<{ message: string }>(`/probes/${id}/run`, { method: 'POST' }),
  delete: (id: number) => req<void>(`/probes/${id}`, { method: 'DELETE' }),
}

// ── Results ──────────────────────────────────────────────────────────────
export const results = {
  list: (probe_id?: number) => {
    const q = probe_id ? `?probe_id=${probe_id}` : ''
    return req<Result[]>(`/results${q}`)
  },
  stats: () => req<DashboardStats>('/stats'),
  status: () => req<{ running: boolean; probes: number; agents: number }>('/status'),
}

// ── Quick Test Logs ──────────────────────────────────────────────────────
export const quickTestLogs = {
  list: (limit = 100) => req<QuickTestLog[]>(`/quick-test-logs?limit=${limit}`),
  get: (id: number) => req<QuickTestLog>(`/quick-test-logs/${id}`),
}

// ── Conversations ────────────────────────────────────────────────────────
export const conversations = {
  list: () => req<Conversation[]>('/conversations'),
  get: (id: number) => req<Conversation>(`/conversations/${id}`),
  create: (d: { target_id: number; name?: string }) =>
    req<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(d) }),
  delete: (id: number) => req<void>(`/conversations/${id}`, { method: 'DELETE' }),
  sendMessage: (convId: number, content: string) =>
    req<Conversation>(`/conversations/${convId}/message`, { method: 'POST', body: JSON.stringify({ content }) }),
}

// ── Extractions (system prompt) ──────────────────────────────────────────
export const extractions = {
  run: (target_id: number) =>
    req<ExtractionRun>('/extractions/run', { method: 'POST', body: JSON.stringify({ target_id }) }),
  runs: () => req<ExtractionRun[]>('/extractions/runs'),
  get: (id: number) => req<ExtractionRun>(`/extractions/runs/${id}`),
}

// ── Human Review ─────────────────────────────────────────────────────────
export const reviews = {
  queue: (limit = 20, minScore = 50) =>
    req<ReviewItem[]>(`/reviews/queue?limit=${limit}&min_score=${minScore}`, { method: 'POST' }),
  list: (reviewed = false, source = '') =>
    req<ReviewItem[]>(`/reviews?reviewed=${reviewed}${source ? `&source=${source}` : ''}`),
  update: (id: number, d: { verdict?: string; notes?: string }) =>
    req<ReviewItem>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  delete: (id: number) => req<void>(`/reviews/${id}`, { method: 'DELETE' }),
}

// ── Automated Agent ──────────────────────────────────────────────────────
export const agent = {
  run: (d: { target_id: number; category?: string; rounds?: number; attacker_target_id?: number }) =>
    req<AgentRun>('/agent/run', { method: 'POST', body: JSON.stringify(d) }),
  runs: () => req<AgentRun[]>('/agent/runs'),
  get: (id: number) => req<AgentRun>(`/agent/runs/${id}`),
}

// ── Exports ──────────────────────────────────────────────────────────────
function downloadBlob(url: string, filename: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  })
}

export const exports = {
  comparison: (id: number, fmt: 'html' | 'csv' | 'json' = 'html') =>
    downloadBlob(`${BASE}/exports/comparisons/${id}?format=${fmt}`, `comparison_${id}.${fmt}`),
  conversation: (id: number, fmt: 'html' | 'json' = 'html') =>
    downloadBlob(`${BASE}/exports/conversations/${id}?format=${fmt}`, `conversation_${id}.${fmt}`),
  quickTestLogs: (fmt: 'csv' | 'json' = 'csv') =>
    downloadBlob(`${BASE}/exports/quick-test-logs?format=${fmt}&limit=500`, `quick_test_logs.${fmt}`),
}

// ── Reports ──────────────────────────────────────────────────────────────
function downloadUrl(url: string, filename: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  })
}

export const reports = {
  generate: (d: { name: string; target_id?: number; date_from?: string; date_to?: string }) =>
    req<Report>('/reports/generate', { method: 'POST', body: JSON.stringify(d) }),
  list: () => req<Report[]>('/reports'),
  get: (id: number) => req<Report>(`/reports/${id}`),
  delete: (id: number) => req<void>(`/reports/${id}`, { method: 'DELETE' }),
  exportHtml: (id: number, name: string) => downloadUrl(`${BASE}/reports/${id}/export?format=html`, `${name.replace(/\s+/g, '_')}.html`),
  exportJson: (id: number, name: string) => downloadUrl(`${BASE}/reports/${id}/export?format=json`, `${name.replace(/\s+/g, '_')}.json`),
  exportMd: (id: number, name: string) => downloadUrl(`${BASE}/reports/${id}/export?format=md`, `${name.replace(/\s+/g, '_')}.md`),
  exportPdf: (id: number, name: string) => downloadUrl(`${BASE}/reports/${id}/export?format=pdf`, `${name.replace(/\s+/g, '_')}.pdf`),
}

// ── Comparisons ──────────────────────────────────────────────────────────
export const comparisons = {
  list: () => req<Comparison[]>('/comparisons'),
  get: (id: number) => req<Comparison>(`/comparisons/${id}`),
  run: (d: { prompt: string; target_ids: number[] }) =>
    req<Comparison>('/comparisons', { method: 'POST', body: JSON.stringify(d) }),
  delete: (id: number) => req<void>(`/comparisons/${id}`, { method: 'DELETE' }),
}

// ── Health ───────────────────────────────────────────────────────────────
export const health = () => req<{ status: string; version: string }>('/health')
