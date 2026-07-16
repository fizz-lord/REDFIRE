import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { results, quickTestLogs } from '../api/client'
import type { DashboardStats, QuickTestLog } from '../types'

const COLORS = ['#c94a4a', '#c4983a', '#4a9a6a', '#c9673a', '#6a4a9a', '#3a8a9a']

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<QuickTestLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([results.stats(), quickTestLogs.list(10)])
      .then(([s, logs]) => { setStats(s); setRecent(logs) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center p-16"><div className="text-[#555] text-sm animate-pulse">Loading dashboard...</div></div>

  const catData = stats?.attacks_by_category
    ? Object.entries(stats.attacks_by_category).map(([k, v]) => ({ name: k.replace(/_/g, ' '), count: v }))
    : []

  const sevData = stats?.severity_distribution
    ? Object.entries(stats.severity_distribution).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
    : []

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold text-[#c9673a] mb-6">[#] Dashboard</h2>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Vuln Scan', value: stats?.total_probes ?? 0, color: 'text-[#c9673a]' },
          { label: 'Attacks', value: stats?.total_attacks ?? 0, color: 'text-[#c4983a]' },
          { label: 'Targets', value: stats?.total_targets ?? 0, color: 'text-[#4a9a6a]' },
          { label: 'Results', value: stats?.total_results ?? 0, color: 'text-[#c94a4a]' },
        ].map(c => (
          <div key={c.label} className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-3">
            <div className="text-[#666] text-xs uppercase tracking-wider">{c.label}</div>
            <div className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Attacks by category bar chart */}
        <div className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4">
          <h3 className="text-[#c4983a] font-semibold text-sm mb-3">Attacks by Category</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catData}>
                <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#555', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '4px', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#c9673a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="text-[#555] text-xs">No attack data yet</div>}
        </div>

        {/* Severity distribution pie chart */}
        <div className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4">
          <h3 className="text-[#c4983a] font-semibold text-sm mb-3">Result Distribution</h3>
          {sevData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                  labelLine={false} label={({ name, percent }) => `${name.replace(/^(qt_|severity\.)/i, '').trim()} ${(percent * 100).toFixed(0)}%`}>
                  {sevData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '4px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="text-[#555] text-xs">No results yet</div>}
        </div>
      </div>

      {/* Two-panel metrics + activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4">
          <h3 className="text-[#c4983a] font-semibold text-sm mb-3">Key Metrics</h3>
          {stats && (
            <div className="space-y-3">
              <MetricBar label="Avg Score" value={`${stats.avg_score.toFixed(1)}%`} pct={Math.min(100, stats.avg_score)} color="bg-[#c4983a]" />
              <MetricBar label="Jailbreak Rate" value={`${stats.jailbreak_rate.toFixed(1)}%`} pct={Math.min(100, stats.jailbreak_rate)} color="bg-[#c94a4a]" />
              <MetricBar label="Critical Breaches" value={String(stats.critical_breaches)} pct={Math.min(100, (stats.critical_breaches / Math.max(1, stats.total_results)) * 100)} color="bg-[#c94a4a]" />
            </div>
          )}
        </div>

        <div className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4">
          <h3 className="text-[#c4983a] font-semibold text-sm mb-3">Recent Quick Tests</h3>
          {recent.length === 0 && <div className="text-[#555] text-xs">No tests yet</div>}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {recent.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center justify-between text-xs">
                <span className="text-[#888] truncate flex-1">{log.prompt?.slice(0, 40) || ''}...</span>
                <span className={`ml-2 shrink-0 ${log.score >= 80 ? 'text-[#c94a4a]' : log.score >= 50 ? 'text-[#c4983a]' : 'text-[#4a9a6a]'}`}>{log.score}/100</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card-hover bg-[#1e1e1e] border border-[#333] rounded p-4">
        <h3 className="text-[#c4983a] font-semibold text-sm mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <ActionBtn label="+ New Target" tab="targets" />
          <ActionBtn label="Chat" tab="conversations" />
          <ActionBtn label="Compare" tab="compare" />
          <ActionBtn label="Seed Attacks" tab="attacks" />
          <ActionBtn label="+ New Vuln Scan" tab="probes" />
          <ActionBtn label="Compare Models" tab="compare" />
          <ActionBtn label="Run Agent" tab="agent" />
          <ActionBtn label="Extract Prompt" tab="extract" />
        </div>
      </div>

      <div className="mt-4 text-[#555] text-xs leading-relaxed">
        <strong className="text-[#888]">Workflow:</strong> Add a Target → Seed the Attack Library → Chat, Compare, or run an Agent
      </div>
    </div>
  )
}

function MetricBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#888]">{label}</span>
        <span className="text-[#ccc] font-semibold">{value}</span>
      </div>
      <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ActionBtn({ label, tab }: { label: string; tab: string }) {
  return (
    <button onClick={() => { window.dispatchEvent(new CustomEvent('navigate', { detail: tab })); window.location.hash = tab }}
      className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#444] px-3 py-1.5 rounded text-xs transition-colors">
      {label}
    </button>
  )
}
