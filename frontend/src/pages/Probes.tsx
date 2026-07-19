import { useEffect, useRef, useState } from 'react'
import { probes as api, targets as tApi, attacks as aApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { Probe, ProbeDetail, Target, Attack } from '../types'

export default function Probes() {
  const { addToast } = useToast()
  const [list, setList] = useState<Probe[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [attacks, setAttacks] = useState<Attack[]>([])
  const [detail, setDetail] = useState<ProbeDetail | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', target_id: 0, attack_ids: [] as number[] })
  const pollingRef = useRef<{ id: number | null; cancelled: boolean }>({ id: null, cancelled: false })

  const load = () => Promise.all([api.list(), tApi.list(), aApi.list()]).then(([p, t, a]) => { setList(p); setTargets(t); setAttacks(a) })
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim() || !form.target_id || !form.attack_ids.length) return
    try {
      await api.create({ ...form, description: form.description })
      setShowForm(false)
      setForm({ name: '', description: '', target_id: 0, attack_ids: [] })
      load()
      addToast('Vuln scan created', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to create scan', 'error')
    }
  }

  const run = async (id: number) => {
    if (pollingRef.current.id === id) return
    pollingRef.current.cancelled = true
    pollingRef.current = { id, cancelled: false }
    try {
      await api.run(id)
      addToast('Vuln scan started', 'success')
      load()
      viewDetail(id)
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000))
        if (pollingRef.current.cancelled || pollingRef.current.id !== id) return
        try {
          const updated = await api.get(id)
          if (pollingRef.current.cancelled || pollingRef.current.id !== id) return
          setDetail(updated)
          if (updated.status !== 'running') {
            addToast('Vuln scan completed', 'success')
            load()
            return
          }
        } catch { return }
      }
      addToast('Vuln scan timed out', 'error')
    } catch (e) {
      addToast((e as Error).message || 'Failed to start scan', 'error')
    } finally {
      if (pollingRef.current.id === id) {
        pollingRef.current.cancelled = true
      }
    }
  }

  useEffect(() => {
    return () => { pollingRef.current.cancelled = true }
  }, [])

  const del = async (id: number) => {
    if (!confirm('Delete this vuln scan and all its results?')) return
    try {
      await api.delete(id)
      setDetail(null)
      load()
      addToast('Vuln scan deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  const viewDetail = async (id: number) => {
    try {
      setDetail(await api.get(id))
    } catch { }
  }

  const toggleAttack = (id: number) => {
    setForm(f => ({
      ...f,
      attack_ids: f.attack_ids.includes(id) ? f.attack_ids.filter(a => a !== id) : [...f.attack_ids, id],
    }))
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#c9673a]">[*] Vuln Scan</h2>
          <button onClick={() => { setShowForm(true); setDetail(null) }}
            className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1.5 rounded text-xs font-semibold">
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {list.map(p => (
            <button key={p.id} onClick={() => viewDetail(p.id)}
              className={`w-full text-left p-2.5 rounded border text-xs transition-colors ${
                detail?.id === p.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-[#ccc] font-semibold truncate">{p.name}</span>
                <span className={`text-[#555] ${p.status === 'running' ? 'text-[#c4983a]' : p.status === 'completed' ? 'text-[#4a9a6a]' : ''}`}>
                  {p.status}
                </span>
              </div>
              <div className="text-[#555] mt-0.5">{new Date(p.created_at).toLocaleString()}</div>
            </button>
          ))}
          {list.length === 0 && <div className="text-[#555] text-xs p-2">No vuln scans yet.</div>}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {showForm && !detail && (
          <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 space-y-3 max-w-xl">
            <h3 className="text-[#c4983a] font-semibold">New Vuln Scan</h3>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Scan name"
              className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
            <select value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: Number(e.target.value) }))}
              className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4]">
              <option value={0}>Select target...</option>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div>
              <div className="text-xs text-[#888] mb-2">Select attacks ({form.attack_ids.length} selected):</div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-[#333] rounded p-2">
                {attacks.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-[#ccc]">
                    <input type="checkbox" checked={form.attack_ids.includes(a.id)} onChange={() => toggleAttack(a.id)}
                      className="accent-[#c9673a]" />
                    <span className={`${scoreColor(a.severity)}`}>{a.severity}</span>
                    <span className="text-[#888] truncate">{a.prompt.slice(0, 80)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={create}
                className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-2 rounded text-sm font-semibold">
                Create Scan
              </button>
              <button onClick={() => setShowForm(false)} className="text-[#888] hover:text-[#ccc] px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#c4983a]">{detail.name}</h3>
                <div className="text-xs text-[#555] mt-1">
                  Status: {detail.status} · Target: {detail.target?.name ?? 'N/A'}
                  · Created: {new Date(detail.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                {detail.status !== 'running' && (
                  <button onClick={() => run(detail.id)}
                    className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1.5 rounded text-xs font-semibold">
                    Run Scan
                  </button>
                )}
                <button onClick={() => del(detail.id)}
                  className="btn-base bg-[#3a1a1a] hover:bg-[#4a2a2a] border border-[#c94a4a]/40 text-[#c94a4a] px-3 py-1.5 rounded text-xs">Delete</button>
              </div>
            </div>

            <div className="space-y-2">
              {detail.attacks.map(ca => (
                <div key={ca.id} className="bg-[#1e1e1e] border border-[#333] rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#c9673a] font-semibold">
                      Attack #{ca.attack_id} · {ca.attack?.category?.replace(/_/g, ' ') || 'unknown'}
                    </span>
                    <span className="text-xs text-[#555]">Status: {ca.status}</span>
                  </div>
                  {ca.attack && <div className="text-xs text-[#555] mb-2 whitespace-pre-wrap">{ca.attack.prompt}</div>}
                  {ca.results?.map(r => (
                    <div key={r.id} className="bg-[#141414] border border-[#2a2a2a] rounded p-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={scoreColor(r.score)}>{r.label} — {r.score}/100</span>
                        <span className="text-[#555]">{r.response_time_ms}ms</span>
                      </div>
                      <div className="text-xs text-[#d4d4d4] mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto">{r.response}</div>
                      <div className="text-xs text-[#555] mt-1">
                        Refusal: {r.refusal_signals} · Compliance: {r.compliance_signals}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {!detail && !showForm && (
          <div className="text-[#555] text-sm p-8 text-center">
            Select a vuln scan from the sidebar, or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}
