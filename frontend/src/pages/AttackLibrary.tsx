import { useEffect, useState } from 'react'
import { attacks as api } from '../api/client'
import { useToast } from '../components/Toast'
import type { Attack } from '../types'

const SEVERITIES = ['low', 'medium', 'high', 'critical']

export default function AttackLibrary() {
  const { addToast } = useToast()
  const [list, setList] = useState<Attack[]>([])
  const [loading, setLoading] = useState(true)
  const [seedMsg, setSeedMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ prompt: '', category: 'custom', severity: 'medium' as string, description: '', mitre_atlas_id: '', owasp_llm_id: '' })
  const [formMsg, setFormMsg] = useState('')

  const load = (cat?: string) => {
    setLoading(true)
    api.list(cat ? { category: cat } : undefined)
      .then(setList)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const seed = async (reseed = false) => {
    setSeedMsg('')
    try {
      const res = await api.seed(reseed)
      setSeedMsg((res as any).message || 'Done')
      load()
      setTimeout(() => setSeedMsg(''), 3000)
    } catch (e: unknown) {
      setSeedMsg(e instanceof Error ? e.message : 'Failed')
    }
  }

  const del = async (id: number) => {
    if (!confirm('Delete this attack?')) return
    try {
      await api.delete(id)
      setList(prev => prev.filter(a => a.id !== id))
      addToast('Attack deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  const saveCustom = async () => {
    if (!form.prompt.trim()) return
    setFormMsg('')
    try {
      await api.create(form as any)
      setForm({ prompt: '', category: 'custom', severity: 'medium', description: '', mitre_atlas_id: '', owasp_llm_id: '' })
      setShowForm(false)
      setFormMsg('Attack saved')
      load()
      setTimeout(() => setFormMsg(''), 3000)
    } catch (e: unknown) {
      setFormMsg(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const cats = [...new Set(list.map(a => a.category))]

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-[#c94a4a]'
      case 'high': return 'text-[#d97a4a]'
      case 'medium': return 'text-[#c4983a]'
      default: return 'text-[#4a9a6a]'
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#c9673a]">[!] Attack Library</h2>
        <div className="flex gap-2">
          <select onChange={e => load(e.target.value || undefined)}
            className="bg-[#141414] border border-[#444] rounded px-3 py-1.5 text-sm text-[#d4d4d4]">
            <option value="">All Categories</option>
            {cats.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => seed(false)}
            className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#444] px-4 py-1.5 rounded text-sm transition-colors">
            Seed Library
          </button>
          <button onClick={() => seed(true)}
            className="bg-[#c9673a]/20 hover:bg-[#c9673a]/30 border border-[#c9673a]/40 text-[#c9673a] px-4 py-1.5 rounded text-sm transition-colors">
            Re-seed
          </button>
          <button onClick={() => { setShowForm(true); setFormMsg('') }}
            className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-1.5 rounded text-sm transition-colors font-semibold">
            + Custom
          </button>
        </div>
      </div>
      {seedMsg && <div className="text-xs text-[#4a9a6a] mb-3">{seedMsg}</div>}
      {formMsg && <div className={`text-xs mb-3 ${formMsg.includes('Failed') || formMsg.includes('Error') ? 'text-[#c94a4a]' : 'text-[#4a9a6a]'}`}>{formMsg}</div>}

      {showForm && (
        <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 mb-4 space-y-3 max-w-2xl">
          <h3 className="text-[#c4983a] font-semibold text-sm">New Custom Attack</h3>
          <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
            rows={4} placeholder="Enter your attack prompt..."
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555] font-mono" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4]">
              <option value="custom">Custom</option>
              <option value="jailbreak">Jailbreak</option>
              <option value="prompt_injection">Prompt Injection</option>
              <option value="harmful_content">Harmful Content</option>
              <option value="pii_extraction">PII Extraction</option>
              <option value="misinformation">Misinformation</option>
            </select>
            <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              className="bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4]">
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          <input value={form.mitre_atlas_id} onChange={e => setForm(f => ({ ...f, mitre_atlas_id: e.target.value }))}
            placeholder="MITRE ATLAS ID (optional)"
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          <div className="flex gap-2">
            <button onClick={saveCustom}
              className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-2 rounded text-sm font-semibold transition-colors">
              Save Attack
            </button>
            <button onClick={() => setShowForm(false)} className="text-[#888] hover:text-[#ccc] px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 && !loading && (
        <div className="bg-[#1e1e1e] border border-[#333] rounded p-6 text-center">
          <p className="text-[#555] mb-3">No attacks in the database yet.</p>
          <button onClick={() => seed(false)}
            className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-6 py-2 rounded text-sm font-semibold transition-colors">
            Load Built-in Attack Library (OWASP LLM Top 10 + MITRE ATLAS)
          </button>
        </div>
      )}

      <div className="space-y-2">
        {list.map(a => (
          <div key={a.id} className="bg-[#1e1e1e] border border-[#333] rounded p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#ccc] leading-relaxed">{a.prompt}</p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-[#c9673a]">{a.category.replace(/_/g, ' ')}</span>
                  <span className={severityColor(a.severity)}>{a.severity}</span>
                  {a.mitre_atlas_id && <span className="text-[#555]">MITRE: {a.mitre_atlas_id}</span>}
                  {a.owasp_llm_id && <span className="text-[#555]">OWASP: {a.owasp_llm_id}</span>}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="text-[#c94a4a] hover:text-[#ff4444] text-xs shrink-0 mt-1">Delete</button>
            </div>
          </div>
        ))}
        {list.length === 0 && !loading && (
          <div className="text-[#555] text-sm p-4">No attacks match the filter.</div>
        )}
      </div>

      {list.length > 0 && (
        <div className="text-[#555] text-xs mt-4">
          {list.length} attacks loaded. Click "+ Custom" to write and store your own.
        </div>
      )}
    </div>
  )
}
