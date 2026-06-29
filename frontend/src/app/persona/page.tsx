import { cookies } from 'next/headers'
import { personaApi, type Summary } from '@/lib/persona-api'

function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl border ${accent ? 'bg-gulf-gold/10 border-gulf-gold/30' : 'bg-gray-900/60 border-gray-800'}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-gulf-gold' : 'text-pale-sand'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function TrendBadge({ value, label }: { value: number; label: string }) {
  const good = value < 0.03
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
      good ? 'bg-muted-emerald/15 text-muted-emerald border-muted-emerald/30'
           : 'bg-warm-rust/15 text-warm-rust border-warm-rust/30'
    }`}>
      {good ? '▼' : '▲'} {(value * 100).toFixed(1)}% {label}
    </span>
  )
}

export default async function PersonaOverviewPage() {
  const cookieStore = await cookies()
  const orgId = cookieStore.get('org_id')?.value

  let summary: Summary | null = null
  let error = ''

  if (orgId) {
    try {
      summary = await personaApi.summary(orgId)
    } catch (e: any) {
      error = e.message ?? 'Failed to load summary'
    }
  }

  const noAgent = !process.env.VOICE_AGENT_API_URL

  return (
    <div className="space-y-8">

      {/* API not configured notice */}
      {noAgent && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
          <strong>Setup needed:</strong> Add <code className="font-mono bg-black/30 px-1 rounded">VOICE_AGENT_API_URL</code> and{' '}
          <code className="font-mono bg-black/30 px-1 rounded">PERSONA_API_KEY</code> to your Vercel environment variables to connect the Persona Tab to your Railway voice agent.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-warm-rust/10 border border-warm-rust/30 text-warm-rust text-sm font-mono">
          {error}
        </div>
      )}

      {/* Primary metrics */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Performance · Last 7 Days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="KB Accuracy"
            value={summary ? `${(100 - (summary.incidents.divergence_rate_7d ?? 0) * 100).toFixed(1)}%` : '—'}
            sub="calls with zero divergence"
            accent
          />
          <StatCard
            label="Open Incidents"
            value={summary?.incidents.open ?? '—'}
            sub="need review"
          />
          <StatCard
            label="Knowledge Gaps"
            value={summary?.gaps.pending ?? '—'}
            sub="pending your review"
          />
          <StatCard
            label="KB Version"
            value={summary?.current_kb_version ?? 'v0'}
            sub="current active rules"
          />
        </div>
      </div>

      {/* Incident health */}
      {summary && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Incident Health</h2>
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <TrendBadge value={summary.incidents.divergence_rate_7d ?? 0} label="divergence rate" />
              {(summary.incidents.divergence_rate_7d ?? 0) >= 0.03 && (
                <span className="text-xs text-warm-rust">
                  ⚠ Alert threshold exceeded (&gt;3%)
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Open',          value: summary.incidents.open,           color: 'text-warm-rust' },
                { label: 'Reviewed',      value: summary.incidents.reviewed,       color: 'text-gulf-gold' },
                { label: 'False Positive',value: summary.incidents.false_positive, color: 'text-gray-400' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gap pipeline */}
      {summary && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Knowledge Gap Pipeline</h2>
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Pending Review', value: summary.gaps.pending,      color: 'text-gulf-gold' },
                { label: 'Approved (30d)', value: summary.gaps.approved_30d, color: 'text-muted-emerald' },
                { label: 'Rejected (30d)', value: summary.gaps.rejected_30d, color: 'text-gray-400' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {(summary.gaps.pending ?? 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <a href="/persona/gaps" className="text-sm text-gulf-gold hover:underline">
                  Review {summary.gaps.pending} pending suggestion{summary.gaps.pending !== 1 ? 's' : ''} →
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state when no data yet */}
      {!summary && !error && !noAgent && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-xl font-bold text-pale-sand mb-2">No data yet</h2>
          <p className="text-gray-400 max-w-sm">
            Noor will populate this dashboard after your first calls. Make a test call to get started.
          </p>
        </div>
      )}
    </div>
  )
}
