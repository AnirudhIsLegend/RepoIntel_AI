import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, FileCode2, Layers, MessageSquare,
  GitBranch, Loader2, AlertTriangle, Network, BookOpen, ExternalLink,
} from 'lucide-react'
import Sidebar from '../components/layout/Sidebar'
import { getRepository, streamRepositoryStatus } from '../api/client'
import { handleRepoNotFound } from '../utils/repoErrors'

/* ── Stat Card ── */
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="glass-hover p-6 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

/* ── Tech Badge ── */
function TechBadge({ name }) {
  return (
    <span className="badge px-3.5 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
      {name}
    </span>
  )
}

/* ── Skeleton ── */
function Skeleton({ className = '' }) {
  return (
    <div className={`rounded-lg animate-pulse ${className}`}
         style={{ background: 'rgba(255,255,255,0.06)' }} />
  )
}

/* ── Processing overlay ── */
const STATUS_MAP = {
  pending:             { label: 'Queued',                 color: 'var(--text-muted)' },
  cloning:             { label: 'Cloning repository…',    color: '#818cf8' },
  parsing:             { label: 'Parsing files…',         color: '#a855f7' },
  indexing:            { label: 'Generating embeddings…', color: 'var(--accent-amber)' },
  generating_overview: { label: 'Analysing codebase…',    color: 'var(--accent-cyan)' },
  ready:               { label: 'Ready',                  color: 'var(--accent-green)' },
  error:               { label: 'Error',                  color: 'var(--accent-red)' },
}

function ProcessingCard({ status, errorMessage }) {
  const info = STATUS_MAP[status] || STATUS_MAP.pending
  return (
    <div className="glass rounded-2xl p-12 text-center max-w-lg mx-auto mt-24">
      {status === 'error' ? (
        <AlertTriangle size={44} style={{ color: 'var(--accent-red)', margin: '0 auto 20px' }} />
      ) : (
        <Loader2 size={44} className="animate-spin mx-auto mb-6" style={{ color: 'var(--accent-violet)' }} />
      )}
      <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {info.label}
      </h2>
      {status === 'error' ? (
        <p className="text-sm leading-relaxed px-2" style={{ color: 'var(--accent-red)' }}>{errorMessage}</p>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Sit tight — this takes a few minutes for large repositories.
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [repo, setRepo] = useState(null)
  const [loading, setLoading] = useState(true)
  const esRef = useRef(null)

  // Initial load — fetch full repo data once
  const fetchRepo = async () => {
    try {
      const { data } = await getRepository(id)
      setRepo(data)
      return data
    } catch (err) {
      if (handleRepoNotFound(err, navigate)) return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const terminalStatuses = new Set(['ready', 'error'])

    fetchRepo().then((initial) => {
      // If already in a terminal state, no SSE needed
      if (initial && terminalStatuses.has(initial.status)) return

      // Open SSE stream for live progress updates
      esRef.current = streamRepositoryStatus(
        id,
        (data) => {
          setRepo((prev) => prev ? { ...prev, ...data } : data)
          // Close SSE once we hit a terminal state
          if (terminalStatuses.has(data.status)) {
            esRef.current?.close()
            // Fetch the full repo object one final time to get all fields
            getRepository(id)
              .then(({ data: full }) => setRepo(full))
              .catch(() => {})
          }
        },
        () => {
          // SSE error — EventSource already closed; state from last event is kept
        },
      )
    })

    return () => {
      // Clean up SSE connection on unmount
      esRef.current?.close()
    }
  }, [id])

  const isReady = repo?.status === 'ready'
  const isError = repo?.status === 'error'
  const isProcessing = repo && !isReady && !isError

  const allTechs = repo?.tech_stack
    ? Object.values(repo.tech_stack).flat()
    : []

  return (
    <div className="flex h-screen">
      <Sidebar repo={repo} />
      <main className="page-main">
        <div className="page-main-inner">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-72 mb-8" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
            <Skeleton className="h-52 mt-6" />
          </div>
        ) : isProcessing ? (
          <ProcessingCard status={repo.status} errorMessage={repo.error_message} />
        ) : isError ? (
          <ProcessingCard status="error" errorMessage={repo.error_message} />
        ) : repo ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-12 gap-6 page-section">
              <div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
                       style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}>
                    {repo.name.split('/').pop().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                      {repo.name.split('/').pop()}
                    </h1>
                    <a href={repo.github_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 text-sm hover:underline"
                       style={{ color: 'var(--text-muted)' }}>
                      <GitBranch size={12} />
                      {repo.github_url.replace('https://github.com/', '')}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>

              <Link
                to={`/repository/${id}/chat`}
                className="btn-primary flex items-center gap-2.5 text-sm relative z-10 px-5 py-3 flex-shrink-0"
              >
                <MessageSquare size={16} />
                Start Chat
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-12 page-section">
              <StatCard label="Files Indexed"  value={repo.file_count?.toLocaleString()}  icon={FileCode2} color="#7c3aed" />
              <StatCard label="Code Chunks"    value={repo.chunk_count?.toLocaleString()} icon={Layers}    color="#4f46e5" />
              <StatCard label="Languages"      value={repo.languages?.length}             icon={GitBranch} color="#06b6d4" />
              <StatCard label="Tech Stack"     value={allTechs.length}                    icon={Layers}    color="#10b981" />
            </div>

            {/* Summary */}
            {repo.summary && (
              <div className="content-card page-section">
                <div className="section-header mb-0">
                  <LayoutDashboard size={18} style={{ color: 'var(--accent-violet)' }} />
                  <h2 className="section-title">Overview</h2>
                </div>
                <p className="text-base leading-relaxed mt-6" style={{ color: 'var(--text-secondary)' }}>
                  {repo.summary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 page-section">
              {/* Tech stack */}
              {repo.tech_stack && Object.keys(repo.tech_stack).length > 0 && (
                <div className="content-card">
                  <h2 className="section-title mb-6">
                    Tech Stack
                  </h2>
                  <div className="space-y-6">
                    {Object.entries(repo.tech_stack).map(([cat, items]) =>
                      items?.length > 0 ? (
                        <div key={cat}>
                          <p className="text-xs font-semibold mb-2.5 capitalize tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            {cat}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {items.map(item => <TechBadge key={item} name={item} />)}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Languages */}
              {repo.languages?.length > 0 && (
                <div className="content-card">
                  <h2 className="section-title mb-6">
                    Languages
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {repo.languages.map(lang => (
                      <div key={lang} className="glass px-4 py-2.5 rounded-lg text-sm flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full"
                             style={{ background: 'var(--accent-violet)' }} />
                        <span style={{ color: 'var(--text-primary)' }}>{lang}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 page-section">
              {/* Important components */}
              {repo.important_components?.length > 0 && (
                <div className="content-card">
                  <div className="section-header mb-0">
                    <Network size={18} style={{ color: 'var(--accent-violet)' }} />
                    <h2 className="section-title">
                      Key Components
                    </h2>
                  </div>
                  <div className="space-y-6 mt-6">
                    {repo.important_components.slice(0, 6).map((comp, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <span className="text-xs font-mono flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', fontSize: '10px' }}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                            {comp.name}
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {comp.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning path */}
              {repo.learning_path?.length > 0 && (
                <div className="content-card">
                  <div className="section-header mb-0">
                    <BookOpen size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <h2 className="section-title">
                      Developer Onboarding Path
                    </h2>
                  </div>
                  <div className="space-y-1 mt-6">
                    {repo.learning_path.map((file, i) => (
                      <div key={i} className="flex items-center gap-4 py-3.5 border-b last:border-0"
                           style={{ borderColor: 'var(--border)' }}>
                        <span className="text-xs font-bold w-6 text-center"
                              style={{ color: 'var(--accent-violet)' }}>{i + 1}</span>
                        <span className="text-sm font-mono leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {file}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
        </div>
      </main>
    </div>
  )
}
