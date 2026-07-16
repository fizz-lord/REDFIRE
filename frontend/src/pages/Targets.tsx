import { useEffect, useState } from 'react'
import { targets as api } from '../api/client'
import type { Target, ProviderType } from '../types'

const PROVIDERS: ProviderType[] = ['openai', 'anthropic', 'ollama', 'custom']

const NEEDS_ENDPOINT: ProviderType[] = ['ollama', 'custom']
const NEEDS_KEY: ProviderType[] = ['openai', 'anthropic', 'custom']

export default function Targets() {
  const [list, setList] = useState<Target[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', provider: 'openai' as ProviderType, model: '', api_key: '', endpoint: '' })
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => api.list().then(setList)
  useEffect(() => { load() }, [])

  const save = async () => {
    setError('')
    setSuccess('')
    try {
      if (editing) {
        await api.update(editing, form)
      } else {
        await api.create(form)
      }
      setShowForm(false)
      setEditing(null)
      setForm({ name: '', provider: 'openai', model: '', api_key: '', endpoint: '' })
      setSuccess(editing ? 'Target updated' : 'Target created')
      load()
    } catch (e: any) {
      setError(e.message || 'Failed to save target')
    }
  }

  const edit = (t: Target) => {
    setForm({ name: t.name, provider: t.provider, model: t.model, api_key: t.api_key, endpoint: t.endpoint })
    setEditing(t.id)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const del = async (id: number) => {
    if (!confirm('Delete this target?')) return
    try {
      await api.delete(id)
      load()
    } catch (e: any) {
      setError(e.message || 'Failed to delete target')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#c9673a]">[~] Targets</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', provider: 'openai', model: '', api_key: '', endpoint: '' }); setError(''); setSuccess('') }}
          className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-2 rounded text-sm font-semibold transition-colors">
          + Add Target
        </button>
      </div>

      {error && <div className="bg-[#3a1a1a] border border-[#c94a4a] rounded p-3 mb-4 text-sm text-[#ff6666]">{error}</div>}
      {success && <div className="bg-[#1a3a1a] border border-[#4ac94a] rounded p-3 mb-4 text-sm text-[#66ff66]">{success}</div>}

      {showForm && (
        <div className="bg-[#1e1e1e] border border-[#333] rounded p-4 mb-6 space-y-3 max-w-lg">
          <h3 className="text-[#c4983a] font-semibold">{editing ? 'Edit' : 'New'} Target</h3>
          <input placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          <select value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value as ProviderType }))}
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4]">
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input placeholder="Model (e.g. gpt-4o, claude-3, z-ai/glm-5.2)" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          {NEEDS_KEY.includes(form.provider) && (
            <input placeholder="API Key" type="password" value={form.api_key} onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))}
              className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          )}
          <input placeholder="Base URL (optional, e.g. https://integrate.api.nvidia.com/v1)" value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))}
            className="w-full bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555]" />
          {form.provider === 'custom' && !form.endpoint && (
            <p className="text-[#c9673a] text-xs">Custom provider requires an endpoint URL</p>
          )}
          <div className="flex gap-2">
            <button onClick={save} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-4 py-2 rounded text-sm font-semibold transition-colors">
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[#888] hover:text-[#ccc] px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {list.map(t => (
          <div key={t.id} className="bg-[#1e1e1e] border border-[#333] rounded p-4 flex items-center justify-between">
            <div>
              <span className="font-semibold text-[#d4d4d4]">{t.name}</span>
              <span className="text-[#c9673a] ml-3 text-sm">{t.provider}</span>
              <span className="text-[#888] ml-2 text-sm">({t.model})</span>
              <span className="text-[#555] ml-4 text-xs">{t.api_key ? 'key set' : 'no key'}</span>
              {t.endpoint && <span className="text-[#555] ml-2 text-xs max-w-[200px] truncate" title={t.endpoint}>{t.endpoint}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => edit(t)} className="text-[#888] hover:text-[#c4983a] text-sm">Edit</button>
              <button onClick={() => del(t.id)} className="text-[#c94a4a] hover:text-[#ff4444] text-sm">Delete</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-[#555] text-sm p-4">No targets yet. Add one to get started.</div>}
      </div>
    </div>
  )
}
