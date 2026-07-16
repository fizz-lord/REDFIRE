import { useEffect, useState, useRef } from 'react'
import { conversations as api, targets as tApi, exports as eApi } from '../api/client'
import type { Conversation, Target } from '../types'

export default function Conversations() {
  const [list, setList] = useState<Conversation[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTarget, setNewTarget] = useState(0)
  const [newName, setNewName] = useState('')
  const chatEnd = useRef<HTMLDivElement>(null)

  const load = () => Promise.all([api.list(), tApi.list()]).then(([c, t]) => { setList(c); setTargets(t) })
  useEffect(() => { load() }, [])
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [selected?.turns])

  const create = async () => {
    if (!newTarget) return
    const conv = await api.create({ target_id: newTarget, name: newName || undefined })
    setList(prev => [conv, ...prev])
    setSelected(conv)
    setShowNew(false)
    setNewTarget(0)
    setNewName('')
  }

  const send = async () => {
    if (!selected || !msg.trim() || sending) return
    setSending(true)
    const text = msg
    setMsg('')
    try {
      const conv = await api.sendMessage(selected.id, text)
      setSelected(conv)
      setList(prev => prev.map(c => c.id === conv.id ? conv : c))
    } catch {
      setMsg(text)
    } finally {
      setSending(false)
    }
  }

  const del = async (id: number) => {
    if (!confirm('Delete this conversation?')) return
    await api.delete(id)
    setList(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const scoreColor = (s: number) => s >= 80 ? 'text-[#c94a4a]' : s >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#c9673a]">[*] Chats</h2>
          <button onClick={() => setShowNew(true)} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1 rounded text-sm font-semibold">+ New</button>
        </div>

        {showNew && (
          <div className="bg-[#1e1e1e] border border-[#333] rounded p-3 mb-4 space-y-2">
            <select value={newTarget} onChange={e => setNewTarget(Number(e.target.value))}
              className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1 text-sm text-[#d4d4d4]">
              <option value={0}>Select target...</option>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (optional)"
              className="w-full bg-[#141414] border border-[#444] rounded px-2 py-1 text-sm text-[#d4d4d4] placeholder-[#555]" />
            <div className="flex gap-2">
              <button onClick={create} className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] px-3 py-1 rounded text-xs font-semibold">Create</button>
              <button onClick={() => setShowNew(false)} className="text-[#888] text-xs">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {list.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                selected?.id === c.id ? 'bg-[#2a2a2a] border-[#c9673a]' : 'bg-[#1e1e1e] border-[#333] hover:border-[#555]'
              }`}>
              <div className="text-[#ccc] font-semibold truncate">{c.name || `Chat ${c.id}`}</div>
              <div className="text-[#555] mt-0.5">{c.turns.length} messages</div>
            </button>
          ))}
          {list.length === 0 && <div className="text-[#555] text-sm p-4">No conversations yet</div>}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selected && (
          <div className="text-[#555] text-sm p-8 text-center">Select a conversation or create a new one</div>
        )}
        {selected && (
          <>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#333]">
                <div>
                  <h3 className="text-[#c4983a] font-semibold">{selected.name || `Chat ${selected.id}`}</h3>
                  <div className="text-xs text-[#555]">Target: {targets.find(t => t.id === selected.target_id)?.name ?? 'unknown'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => eApi.conversation(selected.id, 'html')} className="bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">HTML</button>
                  <button onClick={() => eApi.conversation(selected.id, 'json')} className="bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#444] text-xs text-[#ccc] px-2 py-1 rounded">JSON</button>
                  <button onClick={() => del(selected.id)} className="text-[#c94a4a] text-xs hover:text-[#ff4444]">Delete</button>
                </div>
              </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
              {selected.turns.length === 0 && (
                <div className="text-[#555] text-sm text-center p-4">Send a message to start</div>
              )}
              {selected.turns.map((turn, i) => (
                <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded p-3 ${
                    turn.role === 'user'
                      ? 'bg-[#c9673a]/20 border border-[#c9673a]/30'
                      : 'bg-[#1e1e1e] border border-[#333]'
                  }`}>
                    <div className="flex items-center justify-between text-xs text-[#888] mb-1">
                      <span>{turn.role === 'user' ? 'You' : 'Model'}</span>
                      <span className="text-[#555]">{new Date(turn.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-[#d4d4d4] whitespace-pre-wrap">{turn.content}</div>
                    {turn.role === 'assistant' && turn.label && (
                      <div className={`text-xs mt-2 ${scoreColor(turn.score)}`}>
                        [{turn.label}] {turn.score}/100 · {turn.refusal_signals} refusal · {turn.compliance_signals} compliance
                      </div>
                    )}
                    {turn.role === 'assistant' && turn.details && (
                      <div className="text-xs text-[#555] mt-1">{turn.details}</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && <div className="text-[#555] text-xs text-center">Model thinking...</div>}
              <div ref={chatEnd} />
            </div>

            <div className="flex gap-2">
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={2} placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                className="flex-1 bg-[#141414] border border-[#444] rounded px-3 py-2 text-sm text-[#d4d4d4] placeholder-[#555] resize-none" />
              <button onClick={send} disabled={sending || !msg.trim()}
                className="btn-base bg-[#c9673a] hover:bg-[#d97a4a] text-[#1e1e1e] disabled:bg-[#2a2a2a] disabled:text-[#555] px-4 py-2 rounded text-sm font-semibold self-end">
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
