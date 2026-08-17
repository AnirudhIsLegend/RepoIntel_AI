import { FileCode2, Star } from 'lucide-react'

function truncate(str, max = 300) {
  return str?.length > max ? str.slice(0, max) + '...' : str
}

export default function SourcesPanel({ chunks = [], sources = [] }) {
  const displayChunks = chunks?.length > 0 ? chunks : sources.map(s => ({ file_path: s }))

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r"
           style={{ borderColor: 'var(--border)', background: 'rgba(7,7,17,0.7)' }}>
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <FileCode2 size={16} style={{ color: 'var(--accent-violet)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Retrieved Sources</span>
        </div>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {displayChunks.length} chunk{displayChunks.length !== 1 ? 's' : ''} used
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayChunks.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileCode2 size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Sources will appear here<br />after you ask a question.
            </p>
          </div>
        ) : (
          displayChunks.map((chunk, i) => (
            <div key={i} className="glass p-4 rounded-xl">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-mono font-medium leading-snug break-all"
                      style={{ color: '#a78bfa' }}>
                  {chunk.file_path?.split('/').pop()}
                </span>
                {chunk.relevance_score != null && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star size={10} style={{ color: 'var(--accent-amber)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(chunk.relevance_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs font-mono leading-relaxed"
                 style={{ color: 'var(--text-muted)' }}>
                {truncate(chunk.content, 200)}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
