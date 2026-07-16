import { useEffect, useState } from 'react'
import { targets as tApi, extractions as eApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { Target, ExtractionRun } from '../types'

export default function SystemPrompt() {
  const { addToast } = useToast()
  const [targets, setTargets] = useState<Target[]>([])
  const [targetId, setTargetId] = useState(0)
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<ExtractionRun | null>(null)
  const [history, setHistory] = useState<ExtractionRun[]>([])

  const load = () => Promise.all([tApi.list(), eApi.runs()]).then(([t, r]) => { setTargets(t); setHistory(r) })
  useEffect(() => { load() }, [])

  const run = async () => {
    if (!targetId || running) return
    setRunning(true)
    setCurrent(null)
    try {
      const run = await eApi.run(targetId)
      setCurrent(run)
      setHistory(prev => [run, ...prev].slice(0, 20))
      addToast('Extraction completed', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Extraction failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  const viewRun = async (id: number) => {
    const run = history.find(r => r.id === id)
    if (run && run.results.length) { setCurrent(run); return }
    try { setCurrent(await eApi.get(id)) } catch { }
  }

  const scoreColor = (c: number) => c >= 0.5 ? 'text-[#4a9a6a]' : c >= 0.2 ? 'text-[#c4983a]' : 'text-[#555]'

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col">
        <h2 className="text-xl font-bold text-[#c9673a] mb-4">[*] Extractions</h2>

        <div className="bg-[#1e1e1e] border border-[#333] rounded p-3 space-y-3 mb-4">
          <select value={targetId} onChange={e => setTargetId(Number(e.target.value))}
            className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1.5 text-sm text-[#d4d4d4]">
            <option value={0}>Select target...</option>
            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={run} disabled={running || !targetId}
            className="w-full btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] disabled:bg-[#2a2a2a] disabled:text-[#555] px-3 py-1.5 rounded text-sm font-semibold">
            {running ? 'Running 16 attempts...' : 'Run Extraction'}
          </button>
          {running && <div className="text-xs text-[#555]">Testing 16 extraction techniques against the target. This may take a while...</div>}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <div className="text-xs text-[#555] mb-2">Previous runs</div>
          {history.map(r => (
            <button key={r.id} onClick={() => viewRun(r.id)}
              className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                current?.id === r.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
              }`}>
              <div className="text-[#ccc]">Run #{r.id}</div>
              <div className="text-[#555] mt-0.5">{r.results.filter(x => x.extracted).length} extracted · {new Date(r.created_at).toLocaleString()}</div>
            </button>
          ))}
          {history.length === 0 && <div className="text-[#555] text-xs p-2">No extractions yet</div>}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!current && <div className="text-[#555] text-sm p-8 text-center">Select a target and run extraction, or click a previous run</div>}

        {current && (
          <div className="space-y-4">
            <div className="text-xs text-[#555] mb-2">
              Run #{current.id} · {current.results.length} attempts · {current.results.filter(r => r.extracted).length} likely extracted
            </div>

            {current.results.map(r => (
              <div key={r.id} className={`bg-[#1e1e1e] border rounded p-3 ${
                r.extracted ? 'border-[#4a9a6a]' : 'border-[#333]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2">
                    <span className="bg-[#141414] text-[#888] text-xs px-2 py-0.5 rounded">{r.technique}</span>
                    {r.extracted && <span className="bg-[#1a2a1a] text-[#4a9a6a] text-xs px-2 py-0.5 rounded font-semibold">EXTRACTED</span>}
                  </div>
                  <span className={`text-xs font-mono ${scoreColor(r.confidence)}`}>{Math.round(r.confidence * 100)}%</span>
                </div>

                <details className="group">
                  <summary className="text-xs text-[#888] cursor-pointer hover:text-[#ccc]">Prompt (click to expand)</summary>
                  <div className="text-xs text-[#555] bg-[#141414] rounded p-2 mt-1 whitespace-pre-wrap">{r.prompt}</div>
                </details>

                <div className="mt-2">
                  <div className="text-xs text-[#888] mb-1">Response:</div>
                  <div className="text-xs text-[#d4d4d4] bg-[#141414] rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto">{r.response}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
