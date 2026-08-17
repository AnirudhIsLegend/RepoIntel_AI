import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

function CodeBlock({ language, children }) {
  return (
    <div className="my-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      {language && (
        <div className="flex items-center px-3 py-1.5 text-xs font-mono"
             style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
          {language}
        </div>
      )}
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(0,0,0,0.5)', fontSize: '13px' }}
        showLineNumbers={false}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
        isUser ? 'bg-violet-600' : 'bg-indigo-800/60'
      }`}>
        {isUser
          ? <User size={15} color="white" />
          : <Sparkles size={15} color="#a78bfa" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {isUser ? (
          <div className="px-5 py-3.5 rounded-2xl rounded-tr-sm text-[0.9375rem] leading-relaxed"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}>
            {message.content}
          </div>
        ) : (
          <div className="glass rounded-2xl rounded-tl-sm px-5 py-4 prose-dark text-[0.9375rem] leading-relaxed"
               style={{ maxWidth: '100%' }}>
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <CodeBlock language={match[1]}>{children}</CodeBlock>
                  ) : (
                    <code {...props}>{children}</code>
                  )
                },
                pre({ children }) { return <>{children}</> },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Source citations */}
        {!isUser && message.sources?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono"
                style={{
                  background: 'rgba(124,58,237,0.12)',
                  color: '#a78bfa',
                  border: '1px solid rgba(124,58,237,0.2)',
                }}
              >
                {src.split('/').pop()}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
