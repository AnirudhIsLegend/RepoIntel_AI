import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Network, RefreshCw, AlertTriangle } from 'lucide-react'
import mermaid from 'mermaid'
import { sanitizeMermaidDiagram } from '../../utils/mermaidSanitize'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    background: 'transparent',
    primaryColor: '#7c3aed',
    primaryTextColor: '#f1f5f9',
    primaryBorderColor: '#4f46e5',
    lineColor: '#475569',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    edgeLabelBackground: '#1e293b',
    nodeBorder: '#4f46e5',
    clusterBkg: '#1e293b',
    titleColor: '#f1f5f9',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
  },
  flowchart: { htmlLabels: true, curve: 'basis' },
  securityLevel: 'loose',
})

let _id = 0
function nextId() { return `mermaid-${++_id}` }

async function renderDiagram(source) {
  const cleaned = sanitizeMermaidDiagram(source)
  if (!cleaned) throw new Error('Empty diagram')

  const id = nextId()
  try {
    return await mermaid.render(id, cleaned)
  } catch (firstError) {
    // Last resort: strip edge labels and retry
    const simplified = cleaned
      .split('\n')
      .map(line => line.replace(/--\s*"[^"]*"\s*-->/g, '-->'))
      .join('\n')
    const retryId = nextId()
    return await mermaid.render(retryId, simplified)
  }
}

export default function ArchDiagram({ diagram, folderStructure, importantComponents }) {
  const containerRef = useRef(null)
  const [svgHtml, setSvgHtml] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sanitized, setSanitized] = useState('')

  useEffect(() => {
    if (!diagram) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setSanitized(sanitizeMermaidDiagram(diagram))

    renderDiagram(diagram)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvgHtml(svg)
          setLoading(false)
        }
      })
      .catch(err => {
        console.warn('Mermaid render error:', err)
        if (!cancelled) {
          setError('Could not render diagram. Sanitized source is shown below.')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [diagram])

  return (
    <div className="stack-sections">
      {/* Diagram card */}
      <div className="content-card">
        <div className="section-header">
          <Network size={18} style={{ color: 'var(--accent-violet)' }} />
          <h2 className="section-title">Architecture Diagram</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={22} className="animate-spin" style={{ color: 'var(--accent-violet)' }} />
          </div>
        ) : error ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-5 px-5 py-4 rounded-xl"
                 style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              <AlertTriangle size={16} />
              <span className="text-sm leading-relaxed">{error}</span>
            </div>
            <pre className="glass rounded-xl p-6 text-xs font-mono overflow-auto leading-relaxed"
                 style={{ color: 'var(--text-secondary)' }}>
              {sanitized || diagram}
            </pre>
          </div>
        ) : svgHtml ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            ref={containerRef}
            className="mermaid-wrap mt-8"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <p className="text-sm text-center py-16 mt-8" style={{ color: 'var(--text-muted)' }}>
            No diagram available yet.
          </p>
        )}
      </div>

      {folderStructure && (
        <div className="content-card">
          <h2 className="section-title mb-6">Folder Structure</h2>
          <pre className="text-sm font-mono leading-relaxed overflow-auto"
               style={{ color: 'var(--text-secondary)', maxHeight: '440px' }}>
            {folderStructure}
          </pre>
        </div>
      )}

      {importantComponents?.length > 0 && (
        <div className="content-card">
          <h2 className="section-title mb-6">Key Components</h2>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {importantComponents.map((comp, i) => (
              <div key={i} className="flex items-start gap-5 py-5 first:pt-0 last:pb-0"
                   style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-mono px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
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
    </div>
  )
}
