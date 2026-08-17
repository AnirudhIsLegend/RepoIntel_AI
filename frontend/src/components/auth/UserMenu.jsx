import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LogOut, ChevronDown } from 'lucide-react'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <img
          src={user.avatar_url}
          alt={user.username}
          className="w-7 h-7 rounded-full flex-shrink-0"
          style={{ border: '2px solid rgba(124,58,237,0.4)' }}
        />
        <span className="text-sm font-medium truncate flex-1 text-left">
          {user.username}
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div
            className="absolute bottom-full left-0 right-0 mb-2 z-50 glass rounded-lg overflow-hidden"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {user.username}
              </p>
              {user.email && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {user.email}
                </p>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); logout() }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
