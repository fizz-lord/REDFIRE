import { useState, useEffect, useRef } from 'react'
import { results } from './api/client'
import Dashboard from './pages/Dashboard'
import Probes from './pages/Probes'
import AttackLibrary from './pages/AttackLibrary'
import Targets from './pages/Targets'
import History from './pages/History'
import Conversations from './pages/Conversations'
import Compare from './pages/Compare'
import SystemPrompt from './pages/SystemPrompt'
import AutomatedAgent from './pages/AutomatedAgent'
import Reports from './pages/Reports'

type Tab = 'dashboard' | 'probes' | 'attacks' | 'targets' | 'history' | 'conversations' | 'compare' | 'extract' | 'agent' | 'reports'

const NAV: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '[#]' },
  { key: 'probes', label: 'Vuln Scan', icon: '[*]' },
  { key: 'attacks', label: 'Attack Library', icon: '[!]' },
  { key: 'targets', label: 'Targets', icon: '[~]' },
  { key: 'conversations', label: 'Conversations', icon: '[~]' },
  { key: 'compare', label: 'Compare', icon: '[#]' },
  { key: 'extract', label: 'Extract Prompt', icon: '[!]' },
  { key: 'agent', label: 'Auto Agent', icon: '[~]' },
  { key: 'reports', label: 'Reports', icon: '[+]' },
  { key: 'history', label: 'History', icon: '[#]' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [lastDuration, setLastDuration] = useState(0)
  const wasRunning = useRef(false)
  const elapsedRef = useRef(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail as string
      if (NAV.find(n => n.key === t)) setTab(t as Tab)
    }
    window.addEventListener('navigate', handler)
    return () => window.removeEventListener('navigate', handler)
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await results.status()
        if (wasRunning.current && !s.running) setLastDuration(elapsedRef.current)
        wasRunning.current = s.running
        setRunning(s.running)
      } catch { }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!running) return
    setElapsed(0)
    elapsedRef.current = 0
    const iv = setInterval(() => {
      setElapsed(t => { elapsedRef.current = t + 1; return t + 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [running])

  return (
    <div className="min-h-screen bg-[#141414] text-[#d4d4d4] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1e1e1e] border-r border-[#333] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#333]">
          <h1 className="text-[#c9673a] font-bold text-lg tracking-wider">
            REDFIRE🔥
          </h1>
          <p className="text-[#7a4a2e] text-xs mt-1">LLM Red Teaming Platform</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={`btn-base w-full text-left px-3 py-2.5 rounded text-sm ${
                tab === n.key
                  ? 'bg-[#c9673a]/15 text-[#d97a4a] border-l-2 border-[#c9673a]'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'
              }`}
            >
              <span className="text-[#c9673a] mr-2">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 text-[#555] text-xs border-t border-[#333]">
          v1.0.0 · OWASP LLM Top 10
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6 fade-in">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'probes' && <Probes />}
        {tab === 'attacks' && <AttackLibrary />}
        {tab === 'targets' && <Targets />}
        {tab === 'conversations' && <Conversations />}
        {tab === 'compare' && <Compare />}
        {tab === 'extract' && <SystemPrompt />}
        {tab === 'agent' && <AutomatedAgent />}
        {tab === 'reports' && <Reports />}
        {tab === 'history' && <History />}
      </main>

      {/* Global running indicator */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 z-50 select-none">
        <span className={`w-2.5 h-2.5 rounded-full ${running ? 'bg-[#c9673a] animate-glow-pulse' : 'bg-[#4a9a6a]'}`} />
        <span className="text-xs text-[#555]">
          {running ? `Running ${elapsed}s` : lastDuration > 0 ? `Done — ${lastDuration}s` : 'Idle'}
        </span>
      </div>
    </div>
  )
}
