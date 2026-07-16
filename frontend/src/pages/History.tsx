import { useEffect, useState } from 'react'
import { quickTestLogs, exports as eApi } from '../api/client'
import type { QuickTestLog } from '../types'

export default function History() {
  const [logs, setLogs] = useState<QuickTestLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<QuickTestLog | null>(null)
  const [filter, setFilter] = useState<'all' | 'jailbroken' | 'blocked' | 'error'>('all')

  const load = () => {
    setLoading(true)
    quickTestLogs.list(200).then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l => {
    if (filter === 'jailbroken') return l.label === 'JAILBROKEN'
    if (filter === 'blocked') return l.label === 'BLOCKED'
    if (filter === 'error') return l.score < 0
    return true
  })

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Log list */}
      <div className="w-96 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#c9673a]">[#] Conversation Log</h2>
          <div className="flex gap-2">
            <button onClick={() => eApi.quickTestLogs('csv')} className="bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">CSV</button>
            <button onClick={() => eApi.quickTestLogs('json')} className="bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">JSON</button>
            <button onClick={load} className="text-xs text-[#888] hover:text-[#ccc]">refresh</button>
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {(['all', 'jailbroken', 'blocked', 'error'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                filter === f ? 'bg-[#c9673a] text-[#1e1e1e]' : 'bg-[#2a2a2a] text-[#888] hover:text-[#ccc]'
              }`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && <div className="text-[#555] text-sm p-4">Loading...</div>}
          {!loading && filtered.length === 0 && <div className="text-[#555] text-sm p-4">No logs yet</div>}
          {filtered.map(log => (
            <button key={log.id} onClick={() => setSelected(log)}
              className={`w-full text-left p-3 rounded border transition-colors ${
                selected?.id === log.id
                  ? 'bg-[#2a2a2a] border-[#c9673a]'
                  : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
              }`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={scoreColor(log.score)}>
                  {log.score}/100 [{log.label}]
                </span>
                <span className="text-[#666]">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div className="text-xs text-[#888] truncate">{log.target_name} · {log.model}</div>
              <div className="text-xs text-[#555] truncate mt-1">{log.prompt}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail view */}
      <div className="flex-1 overflow-y-auto">
        {!selected && (
          <div className="text-[#555] text-sm p-8 text-center">Select a log entry to view details</div>
        )}
        {selected && (
          <div className="space-y-4">
            <div className="bg-[#1e1e1e] border border-[#333] rounded p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className={`text-3xl font-bold ${scoreColor(selected.score)}`}>
                  {selected.score}/100
                </div>
                <div>
                  <div className={`text-sm font-semibold ${scoreColor(selected.score)}`}>
                    [{selected.label}]
                  </div>
                  <div className="text-xs text-[#666]">
                    {selected.refusal_signals} refusal signals · {selected.compliance_signals} compliance signals
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-[#888] mb-4">
                <div><span className="text-[#555]">Target:</span> {selected.target_name}</div>
                <div><span className="text-[#555]">Model:</span> {selected.model}</div>
                <div><span className="text-[#555]">Time:</span> {new Date(selected.created_at).toLocaleString()}</div>
                <div><span className="text-[#555]">Transforms:</span> {selected.transform_chain?.length || 0}</div>
              </div>

              {selected.transform_chain && selected.transform_chain.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-[#888] uppercase tracking-wider mb-1">Transform Chain</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.transform_chain.map(t => (
                      <span key={t} className="text-xs bg-[#2a2a2a] text-[#c4983a] px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs text-[#888] uppercase tracking-wider mb-1">Original Prompt</div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-sm text-[#aaa] font-mono whitespace-pre-wrap">
                  {selected.prompt}
                </div>
              </div>

              {selected.prompt !== selected.fired_prompt && (
                <div className="mb-4">
                  <div className="text-xs text-[#c9673a] uppercase tracking-wider mb-1">Transformed Prompt (fired)</div>
                  <div className="bg-[#1a1a1a] border border-[#c9673a]/30 rounded p-3 text-sm text-[#d97a4a] font-mono whitespace-pre-wrap">
                    {selected.fired_prompt}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs text-[#888] uppercase tracking-wider mb-1">Model Response</div>
                <div className="bg-[#141414] border border-[#333] rounded p-3 text-sm text-[#d4d4d4] font-mono max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {selected.response}
                </div>
              </div>

              {selected.details && (
                <div className="text-xs text-[#555] border-t border-[#333] pt-3 mt-3">{selected.details}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
