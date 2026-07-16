import { useEffect, useState } from 'react'
import { reviews as rApi } from '../api/client'
import { useToast } from '../components/Toast'
import type { ReviewItem } from '../types'

export default function HumanReview() {
  const { addToast } = useToast()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<{ id: number; verdict: string; notes: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await rApi.list(tab === 'pending' ? false : true)
      setItems(data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const queue = async () => {
    setLoading(true)
    try {
      const data = await rApi.queue(20, 50)
      setItems(data)
      addToast('Queued new items for review', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to queue', 'error')
    }
    setLoading(false)
  }

  const startEdit = (item: ReviewItem) => {
    setEditing({ id: item.id, verdict: item.verdict, notes: item.notes })
  }

  const save = async () => {
    if (!editing) return
    try {
      await rApi.update(editing.id, { verdict: editing.verdict, notes: editing.notes })
      setEditing(null)
      load()
      addToast('Review saved', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to save', 'error')
    }
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#555]'

  const del = async (id: number) => {
    if (!confirm('Delete this review item?')) return
    try {
      await rApi.delete(id)
      setItems(prev => prev.filter(i => i.id !== id))
      addToast('Review deleted', 'success')
    } catch (e) {
      addToast((e as Error).message || 'Failed to delete', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#c9673a]">[*] Human Review</h2>
        <div className="flex gap-2">
          <button onClick={queue} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1.5 rounded text-xs font-semibold">Queue New</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('pending')}
          className={`text-xs px-3 py-1.5 rounded ${tab === 'pending' ? 'bg-[#c9673a] text-[#1e1e1e]' : 'bg-[#2a2a2a] text-[#888]'}`}>
          Pending Review
        </button>
        <button onClick={() => setTab('done')}
          className={`text-xs px-3 py-1.5 rounded ${tab === 'done' ? 'bg-[#c9673a] text-[#1e1e1e]' : 'bg-[#2a2a2a] text-[#888]'}`}>
          Reviewed
        </button>
      </div>

      {loading && <div className="text-[#555] text-sm">Loading...</div>}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className={`bg-[#1e1e1e] border rounded p-4 ${item.score >= 80 ? 'border-[#c94a4a]' : 'border-[#333]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                <span className="bg-[#141414] text-[#888] text-xs px-2 py-0.5 rounded">{item.source_table}</span>
                <span className={`text-xs font-semibold ${scoreColor(item.score)}`}>{item.label} — {item.score}/100</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#555]">#{item.source_id}</span>
                <button onClick={() => del(item.id)} className="text-[#c94a4a] hover:text-[#ff4444] text-xs">Delete</button>
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
                  <button onClick={save} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1 rounded text-xs font-semibold">Save</button>
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
        {!loading && items.length === 0 && <div className="text-[#555] text-sm p-4">No items to review</div>}
      </div>
    </div>
  )
}
