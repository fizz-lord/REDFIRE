import { useEffect, useState, useRef } from 'react'
import { targets as tApi, agent as aApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { Target, AgentRun } from '../types'

const CATEGORIES = ['jailbreak', 'prompt_injection', 'harmful_content', 'pii_extraction', 'data_extraction', 'misinformation', 'bias', 'ethical', 'system_exploit']

export default function AutomatedAgent() {
  const { addToast } = useToast()
  const [targets, setTargets] = useState<Target[]>([])
  const [targetId, setTargetId] = useState(0)
  const [attackerId, setAttackerId] = useState(0)
  const [category, setCategory] = useState('jailbreak')
  const [rounds, setRounds] = useState(5)
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<AgentRun | null>(null)
  const [history, setHistory] = useState<AgentRun[]>([])
  const [log, setLog] = useState<string[]>([])
  const logEnd = useRef<HTMLDivElement>(null)

  const load = () => Promise.all([tApi.list(), aApi.runs()]).then(([t, r]) => { setTargets(t); setHistory(r) })
  useEffect(() => { load() }, [])
  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])

  const poll = async (id: number) => {
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const run = await aApi.get(id)
        setCurrent(run)
        setLog(prev => {
          const lastRound = prev.length
          const newLogs = run.attacks.filter(a => a.round > lastRound).map(a =>
            `[Round ${a.round}] Score: ${a.score}/100 (${a.label}) — ${a.response.slice(0, 80)}...`
          )
          return newLogs.length ? [...prev, ...newLogs] : prev
        })
        if (run.status === 'completed') {
          setRunning(false)
          setHistory(prev => {
            const filtered = prev.filter(p => p.id !== run.id)
            return [run, ...filtered].slice(0, 20)
          })
          setLog(prev => [...prev, `[Done] ${run.summary}`])
          return
        }
      } catch { return }
    }
    setRunning(false)
    setLog(prev => [...prev, '[Error] Poll timed out'])
  }

  const run = async () => {
    if (!targetId || running) return
    setRunning(true)
    setCurrent(null)
    setLog([])
    try {
      const run = await aApi.run({
        target_id: targetId,
        category,
        rounds,
        ...(attackerId ? { attacker_target_id: attackerId } : {}),
      })
      setCurrent(run)
      setLog(run.attacks.map(a =>
        `[Round ${a.round}] Score: ${a.score}/100 (${a.label}) — ${a.response.slice(0, 80)}...`
      ))
      if (run.status === 'completed') {
        setRunning(false)
        setLog(prev => [...prev, `[Done] ${run.summary}`])
        setHistory(prev => [run, ...prev.filter(p => p.id !== run.id)].slice(0, 20))
      } else {
        setLog(prev => [...prev, '[Running] Waiting for completion...'])
        poll(run.id)
      }
    } catch (e) {
      addToast((e as Error).message || 'Agent run failed', 'error')
      setRunning(false)
    }
  }

  const viewRun = (r: AgentRun) => {
    setCurrent(r)
    setLog(r.attacks.map(a =>
      `[Round ${a.round}] Score: ${a.score}/100 (${a.label}) — ${a.response.slice(0, 80)}...`
    ))
    if (r.status === 'completed') setLog(prev => [...prev, `[Done] ${r.summary}`])
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col">
        <h2 className="text-xl font-bold text-[#c9673a] mb-4">[*] Agent</h2>

        <div className="bg-[#1e1e1e] border border-[#333] rounded p-3 space-y-3 mb-4">
          <select value={targetId} onChange={e => setTargetId(Number(e.target.value))}
            className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1.5 text-sm text-[#d4d4d4]">
            <option value={0}>Target...</option>
            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={attackerId} onChange={e => setAttackerId(Number(e.target.value))}
            className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1.5 text-sm text-[#d4d4d4]">
            <option value={0}>Attacker (same as target)</option>
            {targets.filter(t => t.id !== targetId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1.5 text-sm text-[#d4d4d4]">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#555]">Rounds:</label>
            <input type="number" min={1} max={20} value={rounds} onChange={e => setRounds(Number(e.target.value))}
              className="w-16 bg-[#141414] border border-[#444] rounded px-2 py-1 text-sm text-[#d4d4d4]" />
          </div>
          <button onClick={run} disabled={running || !targetId}
            className="w-full btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] disabled:bg-[#2a2a2a] disabled:text-[#555] px-3 py-1.5 rounded text-sm font-semibold">
            {running ? 'Running Agent...' : 'Run Agent'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <div className="text-xs text-[#555] mb-2">Runs</div>
          {history.map(r => (
            <button key={r.id} onClick={() => viewRun(r)}
              className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                current?.id === r.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-[#ccc]">#{r.id} {r.category}</span>
                <span className={`text-[#555] ${r.status === 'running' ? 'text-[#c4983a]' : ''}`}>{r.status}</span>
              </div>
              <div className="text-[#555] mt-0.5">{r.rounds} rounds · {new Date(r.created_at).toLocaleString()}</div>
            </button>
          ))}
          {history.length === 0 && <div className="text-[#555] text-xs p-2">No runs yet</div>}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!current && !running && <div className="text-[#555] text-sm p-8 text-center">Configure and run the agent, or click a previous run</div>}

        {(current || running) && (
          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Round cards */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[#c4983a] font-semibold">
                  {current ? `Run #${current.id} — ${current.category}` : 'Running...'}
                </h3>
                {running && <span className="text-xs text-[#c4983a] animate-pulse">Agent active...</span>}
              </div>

              {(current?.attacks || []).map(a => (
                <div key={a.id} className={`bg-[#1e1e1e] border rounded p-3 ${
                  a.score >= 80 ? 'border-[#c94a4a]' : a.score >= 50 ? 'border-[#c4983a]' : 'border-[#333]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#888] font-semibold">Round {a.round}</span>
                    <span className={`text-xs font-semibold ${scoreColor(a.score)}`}>
                      {a.label} — {a.score}/100
                    </span>
                  </div>

                  <details className="group mb-2">
                    <summary className="text-xs text-[#888] cursor-pointer hover:text-[#ccc]">Attack prompt</summary>
                    <div className="text-xs text-[#555] bg-[#141414] rounded p-2 mt-1 whitespace-pre-wrap">{a.prompt}</div>
                  </details>

                  <div className="text-xs text-[#d4d4d4] bg-[#141414] rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{a.response}</div>

                  <div className="flex gap-3 mt-2 text-xs text-[#555]">
                    <span>Refusal: {a.refusal_signals}</span>
                    <span>Compliance: {a.compliance_signals}</span>
                    <span>{a.response_time_ms}ms</span>
                    {a.details && <span className="truncate">{a.details}</span>}
                  </div>
                </div>
              ))}

              {running && current?.attacks.length === 0 && <div className="text-[#555] text-sm p-4 text-center">Waiting for first round...</div>}
            </div>

            {/* Live log */}
            <div className="w-80 shrink-0 bg-[#1e1e1e] border border-[#333] rounded p-3 overflow-y-auto">
              <div className="text-xs text-[#888] font-semibold mb-2">Live Log</div>
              {log.map((line, i) => (
                <div key={i} className="text-xs text-[#555] font-mono whitespace-pre-wrap mb-1">{line}</div>
              ))}
              {running && <div className="text-xs text-[#c4983a] animate-pulse">Awaiting next round...</div>}
              <div ref={logEnd} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
