import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GitBranch, Brain, Database, Search, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: Brain,    label: 'Gemini 2.5 Flash' },
  { icon: Database, label: 'ChromaDB RAG' },
  { icon: Search,   label: 'Semantic Search' },
  { icon: Zap,      label: 'Flow Tracing' },
]

function GitHubIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading, login } = useAuth()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  const handleLogin = async () => {
    try {
      await login()
    } catch {
      // login() redirects — errors here mean something is misconfigured
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
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

      <div className="relative z-10 w-full max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          {/* Logo */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <GitBranch size={28} color="white" />
            </div>
            <span className="text-3xl font-bold gradient-text">RepoIntel AI</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-4"
              style={{ color: 'var(--text-primary)' }}>
            Welcome Back
          </h1>
          <p className="text-base text-center mb-10 leading-relaxed max-w-sm"
             style={{ color: 'var(--text-secondary)' }}>
            Sign in with your GitHub account to analyze repositories using AI-powered semantic search.
          </p>

          {/* Login card */}
          <div className="glass rounded-2xl p-8 w-full glow-border">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-base font-semibold transition-all"
              style={{
                background: '#fff',
                color: '#24292f',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <GitHubIcon size={22} />
              Continue with GitHub
            </button>

            <p className="text-xs text-center mt-5 leading-relaxed"
               style={{ color: 'var(--text-muted)' }}>
              We only request read access to your public profile.
              <br />No repository write permissions are required.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-10">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="glass flex items-center gap-2 px-3.5 py-2 rounded-full text-xs"
                   style={{ color: 'var(--text-secondary)' }}>
                <Icon size={12} style={{ color: 'var(--accent-violet)' }} />
                {label}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
