import { NavLink, useParams, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Network, GitBranch,
  ChevronLeft, Loader2,
} from 'lucide-react'
import UserMenu from '../auth/UserMenu'

const STATUS_LABELS = {
  pending:             'Pending',
  cloning:             'Cloning...',
  parsing:             'Parsing...',
  indexing:            'Indexing...',
  generating_overview: 'Analysing...',
  ready:               'Ready',
  error:               'Error',
}

export default function Sidebar({ repo }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const isProcessing = repo && !['ready', 'error'].includes(repo.status)

  const navItems = [
    { to: `/repository/${id}`,              icon: LayoutDashboard, label: 'Overview',     end: true },
    { to: `/repository/${id}/chat`,         icon: MessageSquare,    label: 'Chat',         end: false },
    { to: `/repository/${id}/architecture`, icon: Network,          label: 'Architecture', end: false },
  ]

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
           style={{ borderColor: 'var(--border)', background: 'rgba(7,7,17,0.95)', backdropFilter: 'blur(20px)' }}>

      {/* Header */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mb-5 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ChevronLeft size={14} />
          <span>All repos</span>
        </button>

        {repo ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                {repo.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-sm truncate leading-snug" style={{ color: 'var(--text-primary)' }}>
                {repo.name.split('/').pop()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isProcessing && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent-violet)' }} />}
              <span className={`badge badge-${repo.status}`}>
                {STATUS_LABELS[repo.status] || repo.status}
              </span>
            </div>
          </>
        ) : (
          <div className="h-10 rounded-md animate-pulse" style={{ background: 'var(--bg-surface)' }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer stats */}
      {repo?.status === 'ready' && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Files',   value: repo.file_count  },
              { label: 'Chunks',  value: repo.chunk_count },
            ].map(({ label, value }) => (
              <div key={label} className="glass p-3 rounded-lg text-center">
                <div className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{value?.toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User menu */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <UserMenu />
      </div>

      {/* Branding */}
      <div className="p-5" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <GitBranch size={14} style={{ color: 'var(--accent-violet)' }} />
          <span className="text-xs font-medium gradient-text">RepoIntel AI</span>
        </div>
      </div>
    </aside>
  )
}
