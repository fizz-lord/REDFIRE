import { useEffect, useState } from 'react'
import { targets as tApi, comparisons as cApi, exports as eApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { Target, Comparison } from '../types'

export default function Compare() {
  const { addToast } = useToast()
  const [targets, setTargets] = useState<Target[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Comparison | null>(null)
  const [history, setHistory] = useState<Comparison[]>([])

  const loadHistory = () => cApi.list().then(setHistory).catch(() => {})
  useEffect(() => { tApi.list().then(setTargets); loadHistory() }, [])

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const run = async () => {
    if (!prompt.trim() || selected.size < 2 || running) return
    setRunning(true)
    setResult(null)
    try {
      const cmp = await cApi.run({ prompt, target_ids: [...selected] })
      setResult(cmp)
      setHistory(prev => [cmp, ...prev].slice(0, 20))
      addToast('Comparison completed', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Comparison failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  const del = async (id: number) => {
    if (!confirm('Delete this comparison?')) return
    try {
      await cApi.delete(id)
      setHistory(prev => prev.filter(c => c.id !== id))
      if (result?.id === id) setResult(null)
      addToast('Comparison deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#c9673a]">[*] Side-by-Side Comparison</h2>

      <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 space-y-4">
        <div>
          <label className="text-xs text-[#888] block mb-2">Select targets (at least 2):</label>
          <div className="flex flex-wrap gap-2">
            {targets.map(t => (
              <button key={t.id} onClick={() => toggle(t.id)}
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                  selected.has(t.id)
                    ? 'bg-[#c9673a]/20 border-[#c9673a] text-[#c9673a]'
                    : 'bg-[#141414] border-[#444] text-[#888] hover:border-[#666]'
                }`}>
                {t.name}
              </button>
            ))}
            {targets.length === 0 && <span className="text-[#555] text-xs">No targets configured</span>}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#888] block mb-2">Prompt:</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555] resize-none"
            placeholder="Enter a prompt to test against all selected targets..." />
        </div>

        <button onClick={run} disabled={running || selected.size < 2 || !prompt.trim()}
          className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] disabled:bg-[#2a2a2a] disabled:text-[#555] px-4 py-2 rounded text-sm font-semibold">
          {running ? 'Running...' : `Run Comparison (${selected.size} targets)`}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#888]">Prompt: <span className="text-[#d4d4d4]">{result.prompt}</span></div>
            <div className="flex gap-2">
              <button onClick={() => eApi.comparison(result.id, 'html')} className="btn-base bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">Export HTML</button>
              <button onClick={() => eApi.comparison(result.id, 'csv')} className="btn-base bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">Export CSV</button>
              <button onClick={() => eApi.comparison(result.id, 'json')} className="btn-base bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">Export JSON</button>
              <button onClick={() => del(result.id)} className="btn-base bg-[#3a1a1a] hover:bg-[#4a2a2a] border border-[#c94a4a]/40 text-[#c94a4a] text-xs px-2 py-1 rounded">Delete</button>
            </div>
          </div>
          <div className="grid gap-4 fade-in" style={{ gridTemplateColumns: `repeat(${Math.min(result.results.length, 4)}, 1fr)` }}>
            {result.results.map(r => (
              <div key={r.id} className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4 flex flex-col">
                <div className="text-sm font-semibold text-[#c4983a] mb-1">{r.target_name}</div>
                <div className="text-xs text-[#555] mb-3">Model: {r.model}</div>

                {r.error ? (
                  <div className="text-xs text-[#c94a4a] mb-3">{r.error}</div>
                ) : (
                  <>
                    <div className="text-xs text-[#d4d4d4] whitespace-pre-wrap bg-[#141414] rounded p-3 mb-3 flex-1 max-h-96 overflow-y-auto">{r.response}</div>
                    <div className="space-y-1 text-xs">
                      <div className={`font-semibold ${scoreColor(r.score)}`}>
                        {r.label} — {r.score}/100
                      </div>
                      <div className="text-[#555]">
                        Refusal: {r.refusal_signals} · Compliance: {r.compliance_signals}
                      </div>
                      <div className="text-[#555]">{r.response_time_ms}ms</div>
                      {r.details && <div className="text-[#555]">{r.details}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-[#c4983a] mb-3">Previous Comparisons</h3>
          <div className="space-y-2">
            {history.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <button onClick={() => setResult(c)}
                  className={`flex-1 text-left p-3 rounded border text-xs transition-colors ${
                    result?.id === c.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
                  }`}>
                  <div className="text-[#ccc] font-semibold truncate">{c.prompt.slice(0, 120)}</div>
                  <div className="text-[#555] mt-0.5">{c.results.length} targets · {new Date(c.created_at).toLocaleString()}</div>
                </button>
                <button onClick={() => del(c.id)} className="text-[#c94a4a] hover:text-[#ff4444] text-xs shrink-0">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
