import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import Sidebar from '../components/layout/Sidebar'
import MessageBubble from '../components/chat/MessageBubble'
import SourcesPanel from '../components/chat/SourcesPanel'
import { chatWithRepo, getChatHistory, getRepository } from '../api/client'
import { handleRepoNotFound } from '../utils/repoErrors'

const POLL_MS = 2500

const SUGGESTED = [
  'Explain the overall architecture',
  'How is authentication implemented?',
  'Trace a typical request flow',
  'Where is the database access layer?',
  'Explain the folder structure',
  'How are API routes defined?',
]

function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(79,70,229,0.3)' }}>
        <Sparkles size={15} color="#a78bfa" />
      </div>
      <div className="glass px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full dot-pulse"
               style={{ background: 'var(--accent-violet)' }} />
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [repo, setRepo]           = useState(null)
  const [messages, setMessages]   = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [question, setQuestion]   = useState('')
  const [sending, setSending]     = useState(false)
  const [lastChunks, setLastChunks]   = useState([])
  const [lastSources, setLastSources] = useState([])
  const repoRef = useRef(null)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  /* Fetch repo */
  useEffect(() => {
    const fetchRepo = () =>
      getRepository(id)
        .then(({ data }) => {
          setRepo(data)
          repoRef.current = data
        })
        .catch(err => handleRepoNotFound(err, navigate))

    fetchRepo()
    const interval = setInterval(() => {
      const currentStatus = repoRef.current?.status
      if (currentStatus === 'ready' || currentStatus === 'error') {
        clearInterval(interval)
        return
      }
      fetchRepo()
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [id, navigate])

  /* Load chat history on mount */
  useEffect(() => {
    getChatHistory(id)
      .then(({ data }) => {
        if (data.length > 0) {
          const latestSession = data[0]
          setSessionId(latestSession.id)
          const msgs = latestSession.messages.map(m => ({
            role:    m.role,
            content: m.content,
            sources: m.sources,
            chunks:  m.chunks,
          }))
          setMessages(msgs)
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            if (last.role === 'assistant') {
              setLastSources(last.sources || [])
              setLastChunks(last.chunks || [])
            }
          }
        }
      })
      .catch(() => {})
  }, [id])

  /* Scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleSend = async (q = question) => {
    if (!q.trim() || sending || repo?.status !== 'ready') return

    const userMsg = { role: 'user', content: q, sources: [], chunks: [] }
    setMessages(prev => [...prev, userMsg])
    setQuestion('')
    setSending(true)

    try {
      const { data } = await chatWithRepo(parseInt(id), q, sessionId)
      setSessionId(data.session_id)
      setLastSources(data.sources || [])
      setLastChunks(data.chunks || [])
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: data.answer,
        sources: data.sources,
        chunks:  data.chunks,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        sources: [],
        chunks:  [],
      }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const notReady = repo && repo.status !== 'ready'

  return (
    <div className="flex h-screen">
      <Sidebar repo={repo} />

      {/* Sources panel */}
      <SourcesPanel chunks={lastChunks} sources={lastSources} />

      {/* Main chat panel */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-8 py-5 border-b flex-shrink-0"
             style={{ borderColor: 'var(--border)' }}>
          <MessageSquare size={18} style={{ color: 'var(--accent-violet)' }} />
          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Chat with {repo?.name?.split('/').pop() ?? '…'}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl mx-auto space-y-8">
          {messages.length === 0 && !sending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-12 pb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                <Sparkles size={28} color="white" />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Ask anything about the codebase
              </h2>
              <p className="text-base mb-10 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                I'll retrieve relevant code and explain it using Gemini AI.
              </p>

              {!notReady && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {SUGGESTED.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="glass-hover text-left px-4 py-3.5 rounded-xl text-sm leading-relaxed transition-all"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {notReady && (
                <div className="glass px-5 py-4 rounded-xl inline-flex items-center gap-3 text-sm"
                     style={{ color: 'var(--text-secondary)' }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-violet)' }} />
                  Repository is {repo.status}… please wait.
                </div>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
          </AnimatePresence>

          {sending && <TypingIndicator />}
          <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="px-8 py-5 border-t flex-shrink-0"
             style={{ borderColor: 'var(--border)' }}>
          <form
            onSubmit={e => { e.preventDefault(); handleSend() }}
            className="flex gap-4 items-end max-w-3xl mx-auto"
          >
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={notReady ? 'Waiting for repository to be ready…' : 'Ask about architecture, flows, auth, or any file…'}
              disabled={sending || notReady}
              rows={2}
              className="input-dark resize-none flex-1"
              style={{ borderRadius: '14px', lineHeight: '1.6', paddingTop: '0.875rem', paddingBottom: '0.875rem' }}
            />
            <button
              type="submit"
              disabled={sending || !question.trim() || notReady}
              className="btn-primary w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              style={{ padding: 0 }}
            >
              {sending
                ? <Loader2 size={18} className="animate-spin" />
                : <Send size={18} />
              }
            </button>
          </form>
          <p className="text-xs mt-3 text-center max-w-3xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Press Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  )
}
