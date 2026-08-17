import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Network, Loader2 } from 'lucide-react'
import Sidebar from '../components/layout/Sidebar'
import ArchDiagram from '../components/architecture/ArchDiagram'
import { getRepository, getArchitecture } from '../api/client'
import { handleRepoNotFound } from '../utils/repoErrors'

const POLL_MS = 2500

export default function ArchitecturePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [repo, setRepo]       = useState(null)
  const [arch, setArch]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRepository(id), getArchitecture(id)])
      .then(([repoRes, archRes]) => {
        setRepo(repoRes.data)
        setArch(archRes.data)
      })
      .catch(err => handleRepoNotFound(err, navigate))
      .finally(() => setLoading(false))

    const interval = setInterval(() => {
      getRepository(id)
        .then(({ data }) => setRepo(data))
        .catch(err => handleRepoNotFound(err, navigate))
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [id, navigate])

  return (
    <div className="flex h-screen">
      <Sidebar repo={repo} />
      <main className="page-main">
        <div className="page-main-inner">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(124,58,237,0.15)' }}>
            <Network size={20} style={{ color: 'var(--accent-violet)' }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Architecture</h1>
            <p className="text-base mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              AI-generated architecture diagram and component breakdown
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-violet)' }} />
          </div>
        ) : repo?.status !== 'ready' ? (
          <div className="glass rounded-xl p-12 text-center max-w-md mx-auto mt-16">
            <Loader2 size={36} className="animate-spin mx-auto mb-5" style={{ color: 'var(--accent-violet)' }} />
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Architecture will be available once the repository is fully analysed.
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <ArchDiagram
              diagram={arch?.architecture_diagram || repo?.architecture_diagram}
              folderStructure={arch?.folder_structure || repo?.folder_structure}
              importantComponents={arch?.important_components || repo?.important_components}
            />
          </motion.div>
        )}
        </div>
      </main>
    </div>
  )
}
