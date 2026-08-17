import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, Sparkles, Database, Search, ArrowRight,
  CheckCircle2, Circle, Loader2, AlertTriangle,
  Code2, Zap, Brain, Link, LogOut,
} from 'lucide-react'
import { analyzeRepository, getRepository, listRepositories } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ── Progress steps ── */
const STEPS = [
  { key: 'cloning',             label: 'Cloning Repository',      desc: 'Fetching source code from GitHub…',       icon: GitBranch },
  { key: 'parsing',             label: 'Parsing Files',            desc: 'Reading and filtering source files…',     icon: Code2 },
  { key: 'indexing',            label: 'Generating Embeddings',    desc: 'Embedding code with Gemini AI…',          icon: Brain },
  { key: 'generating_overview', label: 'Building Knowledge Base',  desc: 'Analysing architecture with Gemini…',     icon: Database },
  { key: 'ready',               label: 'Repository Ready!',        desc: 'Your codebase is ready to explore.',      icon: Sparkles },
]

const ORDER = ['pending', 'cloning', 'parsing', 'indexing', 'generating_overview', 'ready']

function stepIndex(status) {
  return ORDER.indexOf(status)
}

/* ── Feature Pills ── */
const FEATURES = [
  { icon: Brain,    label: 'Gemini 2.5 Flash' },
  { icon: Database, label: 'ChromaDB RAG' },
  { icon: Search,   label: 'Semantic Search' },
  { icon: Zap,      label: 'Flow Tracing' },
]

/* ── Recent Repo Card ── */
function RecentRepoCard({ repo, onClick }) {
  return (
    <button
      onClick={() => onClick(repo.id)}
      className="glass-hover text-left p-5 rounded-xl w-full transition-all"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}>
          {repo.name.split('/').pop().charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {repo.name.split('/').pop()}
        </span>
        <span className={`badge badge-${repo.status} ml-auto`} style={{ flexShrink: 0 }}>
          {repo.status}
        </span>
      </div>
      <p className="text-sm truncate leading-relaxed" style={{ color: 'var(--text-muted)' }}>{repo.github_url}</p>
    </button>
  )
}

/* ── Navbar ── */
function Navbar() {
  const { user, logout } = useAuth()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex min-h-[72px] items-center justify-between px-[30px] py-[15px]"
      style={{
        background: 'rgba(7,7,17,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-[15px]">
        <div
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          <GitBranch size={21} color="white" />
        </div>
        <span className="font-bold text-lg gradient-text">RepoIntel AI</span>
      </div>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar_url}
              alt={user.username}
              className="w-[42px] h-[42px] rounded-full"
              style={{ border: '2.25px solid rgba(124,58,237,0.5)' }}
            />
            <span className="text-[15px] font-semibold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
              {user.username}
            </span>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-2 px-[15px] py-[9px] rounded-lg text-xs font-semibold transition-colors"
            style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      )}
    </header>
  )
}

export default function Landing() {

  const navigate = useNavigate()
  const [url, setUrl]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [repoId, setRepoId]     = useState(null)
  const [repoStatus, setRepoStatus] = useState(null)
  const [error, setError]       = useState('')
  const [recentRepos, setRecentRepos] = useState([])

  /* Load recent repos (refetch on mount and when tab regains focus) */
  const loadRecentRepos = () => {
    listRepositories()
      .then(({ data }) => setRecentRepos(data.slice(0, 4)))
      .catch(() => setRecentRepos([]))
  }

  useEffect(() => {
    loadRecentRepos()
    window.addEventListener('focus', loadRecentRepos)
    return () => window.removeEventListener('focus', loadRecentRepos)
  }, [])



  /* Poll status when we have a repo ID */
  useEffect(() => {
    if (!repoId) return
    const poll = setInterval(async () => {
      try {
        const { data } = await getRepository(repoId)
        setRepoStatus(data.status)
        if (data.status === 'ready') {
          clearInterval(poll)
          setTimeout(() => navigate(`/repository/${repoId}`), 800)
        }
        if (data.status === 'error') {
          clearInterval(poll)
          setError(data.error_message || 'An error occurred while processing the repository.')
          setLoading(false)
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          clearInterval(poll)
          setRecentRepos(prev => prev.filter(r => r.id !== repoId))
          setLoading(false)
          setRepoId(null)
          return
        }
        clearInterval(poll)
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [repoId, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    setError('')
    setLoading(true)
    setRepoStatus('pending')

    try {
      const { data } = await analyzeRepository(url.trim())
      setRepoId(data.id)
      setRepoStatus(data.status)
      if (data.status === 'ready') {
        navigate(`/repository/${data.id}`)
      }
    } catch (err) {
      setError(err.response?.data?.github_url?.[0] || err.response?.data?.error || 'Failed to submit. Is the Django server running?')
      setLoading(false)
      setRepoStatus(null)
    }
  }

  const currentStep = stepIndex(repoStatus)

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center">
      {/* ── Top Navbar ── */}
      <Navbar />
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 25, 0], scale: [1, 0.9, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute top-1/3 -right-32 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #4f46e5, transparent)' }}
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
          className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }}
        />
      </div>

      <div className="relative z-10 landing-shell">
        <div className="landing-stack">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                <GitBranch size={24} color="white" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold gradient-text">RepoIntel AI</span>
            </div>
          </motion.div>

          {/* Hero headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="landing-hero"
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.2] mb-6 tracking-tight text-center">
              <span style={{ color: 'var(--text-primary)' }}>Understand Any </span>
              <span className="gradient-text">Codebase</span>
              <br />
              <span style={{ color: 'var(--text-primary)' }}>Using </span>
              <span className="gradient-text">AI + RAG</span>
            </h1>
            <p className="landing-subtitle">
              Paste a GitHub URL. Ask questions about architecture, flows, auth — anything.
              {' '}Powered by Gemini AI and semantic search.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 w-full"
          >
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="glass flex items-center gap-2 px-4 py-2.5 rounded-full text-sm"
                   style={{ color: 'var(--text-secondary)' }}>
                <Icon size={14} style={{ color: 'var(--accent-violet)' }} />
                {label}
              </div>
            ))}
          </motion.div>

          {/* URL input card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-8 sm:p-10 glow-border landing-card w-full"
          >
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium mb-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                GitHub Repository URL
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }} />
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError('') }}
                  placeholder="https://github.com/owner/repository"
                  className="input-dark"
                  disabled={loading}
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm relative z-10 disabled:opacity-50 disabled:cursor-not-allowed sm:flex-shrink-0"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>Analyse <ArrowRight size={14} /></>
                )}
              </button>
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-3 mt-5 text-sm px-4 py-3 rounded-lg leading-relaxed"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                <AlertTriangle size={14} />
                {error}
              </motion.div>
            )}
          </form>

          {/* Progress steps */}
          <AnimatePresence>
            {loading && repoStatus && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-10 space-y-4 overflow-hidden"
              >
                <div className="h-px mb-6" style={{ background: 'var(--border)' }} />
                {STEPS.map((step, i) => {
                  const done    = currentStep > i
                  const active  = stepIndex(step.key) === currentStep

                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-4 py-4 px-5 rounded-xl transition-all ${
                        active ? 'glass' : ''
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                      ) : active ? (
                        <Loader2 size={18} className="animate-spin flex-shrink-0"
                                 style={{ color: 'var(--accent-violet)' }} />
                      ) : (
                        <Circle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <div>
                        <p className="text-sm font-medium" style={{
                          color: done
                            ? 'var(--accent-green)'
                            : active
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)',
                        }}>
                          {step.label}
                        </p>
                        {active && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>

          {/* Recent repos */}
          {!loading && recentRepos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="w-full"
            >
              <p className="text-sm font-medium mb-6 text-center tracking-wide uppercase"
                 style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Recent repositories
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {recentRepos.map(repo => (
                  <RecentRepoCard
                    key={repo.id}
                    repo={repo}
                    onClick={id => navigate(`/repository/${id}`)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
