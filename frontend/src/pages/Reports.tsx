import { useEffect, useState } from 'react'
import { reports as rApi, targets as tApi, reviews as revApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { Report, Target, ReviewItem } from '../types'

export default function Reports() {
  const { addToast } = useToast()
  const [tab, setTab] = useState<'generate' | 'reports' | 'review'>('generate')
  const [targets, setTargets] = useState<Target[]>([])
  const [reportList, setReportList] = useState<Report[]>([])
  const [selected, setSelected] = useState<Report | null>(null)
  const [summary, setSummary] = useState<any>(null)

  const [form, setForm] = useState({ name: '', target_id: 0 })

  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewTab, setReviewTab] = useState<'pending' | 'done'>('pending')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [editing, setEditing] = useState<{ id: number; verdict: string; notes: string } | null>(null)

  useEffect(() => { tApi.list().then(setTargets) }, [])
  useEffect(() => {
    if (tab === 'reports') rApi.list().then(setReportList).catch(() => {})
  }, [tab])

  const loadReviews = async () => {
    setReviewLoading(true)
    try {
      const data = await revApi.list(reviewTab === 'pending' ? false : true)
      setReviewItems(data)
    } catch { }
    setReviewLoading(false)
  }
  useEffect(() => { if (tab === 'review') loadReviews() }, [tab, reviewTab])

  const generate = async () => {
    if (!form.name.trim()) { addToast('Enter a report name', 'error'); return }
    try {
      const r = await rApi.generate({ name: form.name, target_id: form.target_id || undefined })
      setReportList(prev => [r, ...prev])
      setSelected(r)
      setSummary(JSON.parse(r.summary_json))
      setTab('reports')
      addToast('Report generated', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to generate', 'error')
    }
  }

  const viewReport = (r: Report) => {
    setSelected(r)
    setSummary(JSON.parse(r.summary_json))
  }

  const del = async (id: number) => {
    if (!confirm('Delete this report?')) return
    try {
      await rApi.delete(id)
      setReportList(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) { setSelected(null); setSummary(null) }
      addToast('Report deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  const queueForReview = async () => {
    setReviewLoading(true)
    try {
      const data = await revApi.queue(20, 50)
      setReviewItems(data)
      addToast('Queued new items for review', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to queue', 'error')
    }
    setReviewLoading(false)
  }

  const startEdit = (item: ReviewItem) => {
    setEditing({ id: item.id, verdict: item.verdict, notes: item.notes })
  }

  const saveReview = async () => {
    if (!editing) return
    try {
      await revApi.update(editing.id, { verdict: editing.verdict, notes: editing.notes })
      setEditing(null)
      loadReviews()
      addToast('Review saved', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to save', 'error')
    }
  }

  const delReview = async (id: number) => {
    if (!confirm('Delete this review item?')) return
    try {
      await revApi.delete(id)
      setReviewItems(prev => prev.filter(i => i.id !== id))
      addToast('Review deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  const es = summary?.executive_summary || {}

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col">
        <h2 className="text-xl font-bold text-[#c9673a] mb-4">[+] Reports</h2>

        <div className="flex flex-col gap-1 mb-4">
          <button onClick={() => setTab('generate')}
            className={`text-left px-3 py-2 rounded text-sm transition-colors ${tab === 'generate' ? 'bg-[#c9673a]/15 text-[#d97a4a] border-l-2 border-[#c9673a]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'}`}>
            Generate Report
          </button>
          <button onClick={() => setTab('reports')}
            className={`text-left px-3 py-2 rounded text-sm transition-colors ${tab === 'reports' ? 'bg-[#c9673a]/15 text-[#d97a4a] border-l-2 border-[#c9673a]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'}`}>
            Reports ({reportList.length})
          </button>
          <button onClick={() => setTab('review')}
            className={`text-left px-3 py-2 rounded text-sm transition-colors ${tab === 'review' ? 'bg-[#c9673a]/15 text-[#d97a4a] border-l-2 border-[#c9673a]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'}`}>
            Review Queue
          </button>
        </div>

        {tab === 'reports' && (
          <div className="flex-1 overflow-y-auto space-y-1">
            {reportList.map(r => (
              <button key={r.id} onClick={() => viewReport(r)}
                className={`w-full text-left p-2.5 rounded border text-xs transition-colors ${
                  selected?.id === r.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
                }`}>
                <div className="text-[#ccc] font-semibold truncate">{r.name}</div>
                <div className="text-[#555] mt-0.5">{new Date(r.created_at).toLocaleString()}</div>
              </button>
            ))}
            {reportList.length === 0 && <div className="text-[#555] text-xs p-2">No reports yet</div>}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'generate' && (
          <div className="max-w-xl space-y-4">
            <h3 className="text-lg font-bold text-[#c4983a]">Generate Report</h3>
            <p className="text-xs text-[#555]">Create a professional report aggregating data from all test sections.</p>

            <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 space-y-3">
              <div>
                <label className="text-xs text-[#888] block mb-1">Report Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. GPT-4 Safety Evaluation"
                  className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
              </div>
              <div>
                <label className="text-xs text-[#888] block mb-1">Filter by Target (optional)</label>
                <select value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: Number(e.target.value) }))}
                  className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4]">
                  <option value={0}>All Targets</option>
                  {targets.map(t => <option key={t.id} value={t.id}>{t.name} ({t.model})</option>)}
                </select>
              </div>
              <button onClick={generate}
                className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-2 rounded text-sm font-semibold">
                Generate Report
              </button>
            </div>

            <div className="text-xs text-[#555] space-y-1">
              <p>The report will include data from:</p>
              <ul className="list-disc list-inside">
                <li>Vuln Scan — results, scores, breach rates</li>
                <li>Side-by-Side Comparisons — per-target performance</li>
                <li>Conversations — turn counts, interaction depth</li>
                <li>Automated Agent Runs — rounds, attack scores</li>
                <li>Extraction Attempts — techniques used, extraction rate</li>
                <li>Human Reviews — verdict summaries</li>
                <li>False Positive Detection — auto-flagged suspicious results</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'reports' && !selected && (
          <div className="text-[#555] text-sm p-8 text-center">Select a report from the sidebar to view details, or generate a new one.</div>
        )}

        {tab === 'reports' && selected && summary && (
          <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#c4983a]">{selected.name}</h3>
                  <div className="text-xs text-[#555] mt-1">
                    {new Date(selected.created_at).toLocaleString()}
                    {summary.target ? ` · ${summary.target.name} (${summary.target.model}, ${summary.target.provider})` : ' · All targets'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => rApi.exportHtml(selected.id, selected.name)}
                    className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-2.5 py-1.5 rounded text-xs font-semibold">HTML</button>
                  <button onClick={() => rApi.exportJson(selected.id, selected.name)}
                    className="btn-base bg-[#2a5a8a] hover:bg-[#3a6a9a] text-[#d4d4d4] px-2.5 py-1.5 rounded text-xs font-semibold">JSON</button>
                  <button onClick={() => rApi.exportMd(selected.id, selected.name)}
                    className="btn-base bg-[#4a6a3a] hover:bg-[#5a7a4a] text-[#d4d4d4] px-2.5 py-1.5 rounded text-xs font-semibold">MD</button>
                  <button onClick={() => rApi.exportPdf(selected.id, selected.name)}
                    className="btn-base bg-[#8a3a4a] hover:bg-[#9a4a5a] text-[#d4d4d4] px-2.5 py-1.5 rounded text-xs font-semibold">PDF</button>
                  <button onClick={() => del(selected.id)}
                    className="btn-base bg-[#3a1a1a] hover:bg-[#4a2a2a] border border-[#c94a4a]/40 text-[#c94a4a] px-2.5 py-1.5 rounded text-xs">Delete</button>
                </div>
              </div>

            {/* Executive Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-3">
                <div className="text-2xl font-bold text-[#d4d4d4]">{es.avg_score}</div>
                <div className="text-xs text-[#555] mt-1">Avg Score</div>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-3">
                <div className="text-2xl font-bold text-[#c94a4a]">{es.critical_breaches}</div>
                <div className="text-xs text-[#555] mt-1">Critical Breaches</div>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-3">
                <div className="text-2xl font-bold text-[#c4983a]">{es.jailbreak_rate}%</div>
                <div className="text-xs text-[#555] mt-1">Jailbreak Rate</div>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-3">
                <div className="text-2xl font-bold text-[#c94a4a]">{es.total_false_positives}</div>
                <div className="text-xs text-[#555] mt-1">Flagged FPs</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Vuln Scan</span><span className="text-[#d4d4d4]">{es.total_probes}</span>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Comparisons</span><span className="text-[#d4d4d4]">{es.total_comparisons}</span>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Conversations</span><span className="text-[#d4d4d4]">{es.total_conversations}</span>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Agent Runs</span><span className="text-[#d4d4d4]">{es.total_agent_runs}</span>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Extractions</span><span className="text-[#d4d4d4]">{es.total_extractions}</span>
              </div>
              <div className="bg-[#1e1e1e] border border-[#333] rounded p-2 flex justify-between">
                <span className="text-[#555]">Reviewed</span><span className="text-[#d4d4d4]">{es.total_reviews}</span>
              </div>
            </div>

            {/* False Positives */}
            <div>
              <h4 className="text-[#c4983a] font-semibold text-sm mb-2">
                False Positives Detected
                {summary.false_positives?.length > 0 && <span className="text-[#c94a4a] ml-2">({summary.false_positives.length})</span>}
              </h4>
              {summary.false_positives?.length > 0 ? (
                <div className="space-y-2">
                  {summary.false_positives.map((fp: any, i: number) => (
                    <div key={i} className="bg-[#1e1e1e] border border-[#c94a4a]/30 rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#888]">{fp.source} #{fp.id}</span>
                        <span className={`text-xs font-semibold ${scoreColor(fp.score)}`}>{fp.label} — {fp.score}/100</span>
                      </div>
                      <div className="text-xs text-[#555] bg-[#141414] rounded p-2 mb-1">Prompt: {fp.prompt}</div>
                      <div className="text-xs text-[#555] bg-[#141414] rounded p-2 mb-1">Response: {fp.response}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#c94a4a]">Reasons: {fp.fp_reasons?.join(', ')}</span>
                        <span className="text-[#555]">Confidence: {fp.fp_confidence}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#555] p-3 bg-[#1e1e1e] border border-[#333] rounded">No false positives detected in this report.</div>
              )}
            </div>

            {/* Verdict Summary */}
            {es.verdict_summary && Object.keys(es.verdict_summary).length > 0 && (
              <div>
                <h4 className="text-[#c4983a] font-semibold text-sm mb-2">Verdict Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(es.verdict_summary).map(([v, c]) => (
                    <div key={v} className="bg-[#1e1e1e] border border-[#333] rounded p-3 text-center">
                      <div className="text-lg font-bold text-[#d4d4d4]">{c as number}</div>
                      <div className="text-xs text-[#555] mt-1">{v.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#c4983a]">Review Queue</h3>
              <button onClick={queueForReview}
                className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1.5 rounded text-xs font-semibold">Queue New</button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setReviewTab('pending')}
                className={`text-xs px-3 py-1.5 rounded ${reviewTab === 'pending' ? 'bg-[#c9673a] text-[#1e1e1e]' : 'bg-[#2a2a2a] text-[#888]'}`}>
                Pending Review
              </button>
              <button onClick={() => setReviewTab('done')}
                className={`text-xs px-3 py-1.5 rounded ${reviewTab === 'done' ? 'bg-[#c9673a] text-[#1e1e1e]' : 'bg-[#2a2a2a] text-[#888]'}`}>
                Reviewed
              </button>
            </div>

            {reviewLoading && <div className="text-[#555] text-sm">Loading...</div>}

            <div className="space-y-3">
              {reviewItems.map(item => (
                <div key={item.id} className={`bg-[#1e1e1e] border rounded p-4 ${item.score >= 80 ? 'border-[#c94a4a]' : 'border-[#333]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2 items-center">
                      <span className="bg-[#141414] text-[#888] text-xs px-2 py-0.5 rounded">{item.source_table}</span>
                      <span className={`text-xs font-semibold ${scoreColor(item.score)}`}>{item.label} — {item.score}/100</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#555]">#{item.source_id}</span>
                      <button onClick={() => delReview(item.id)} className="text-[#c94a4a] hover:text-[#ff4444] text-xs">Delete</button>
                    </div>
                  </div>

                  <details className="group mb-2">
                    <summary className="text-xs text-[#888] cursor-pointer hover:text-[#ccc]">Prompt</summary>
                    <div className="text-xs text-[#555] bg-[#141414] rounded p-2 mt-1 whitespace-pre-wrap">{item.prompt}</div>
                  </details>

                  <div className="text-xs text-[#d4d4d4] bg-[#141414] rounded p-2 mb-3 whitespace-pre-wrap max-h-32 overflow-y-auto">{item.response}</div>

                  {editing?.id === item.id ? (
                    <div className="space-y-2">
                      <select value={editing.verdict} onChange={e => setEditing({ ...editing, verdict: e.target.value })}
                        className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1 text-xs text-[#d4d4d4]">
                        <option value="">Select verdict...</option>
                        <option value="confirmed_breach">Confirmed Breach</option>
                        <option value="false_positive">False Positive</option>
                        <option value="uncertain">Uncertain</option>
                        <option value="refusal">Refusal</option>
                      </select>
                      <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })}
                        rows={2} placeholder="Notes..."
                        className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1 text-xs text-[#d4d4d4] placeholder-[#555] resize-none" />
                      <div className="flex gap-2">
                        <button onClick={saveReview} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1 rounded text-xs font-semibold">Save</button>
                        <button onClick={() => setEditing(null)} className="text-[#888] text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {item.reviewed ? (
                        <span className="text-xs text-[#4a9a6a]">Verdict: {item.verdict}{item.notes ? ` — ${item.notes}` : ''}</span>
                      ) : (
                        <button onClick={() => startEdit(item)} className="bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">Review</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!reviewLoading && reviewItems.length === 0 && <div className="text-[#555] text-sm p-4">No items to review</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
