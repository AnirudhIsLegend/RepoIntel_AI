/**
 * Sanitize LLM-generated Mermaid so it parses reliably in the browser.
 */
export function sanitizeMermaidDiagram(raw) {
  if (!raw || typeof raw !== 'string') return ''

  let text = raw.trim()

  // Strip markdown fences
  text = text.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

  // Normalize newlines and remove trailing semicolons (common LLM mistake)
  text = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/;\s*$/, '').trimEnd())
    .join('\n')
    .trim()

  if (!text) return ''

  // Prefer flowchart syntax (more forgiving in Mermaid v10+)
  if (/^graph\s+(TD|TB|LR|RL|BT|DT)/im.test(text)) {
    text = text.replace(/^graph\s+/im, 'flowchart ')
  } else if (!/^flowchart\s+/im.test(text)) {
    text = `flowchart TD\n${text}`
  }

  // Quote square-bracket node labels: id[label] -> id["label"]
  text = text.replace(
    /([A-Za-z_][\w-]*)\[([^\]"\n]+)\]/g,
    (_, id, label) => `${id}["${escapeMermaidLabel(label)}"]`,
  )

  // Quote round nodes: id((label))
  text = text.replace(
    /([A-Za-z_][\w-]*)\(\(([^)"\n]+)\)\)/g,
    (_, id, label) => `${id}(("${escapeMermaidLabel(label)}"))`,
  )

  // Quote diamond nodes: id{label}
  text = text.replace(
    /([A-Za-z_][\w-]*)\{([^}"\n]+)\}/g,
    (_, id, label) => `${id}{"${escapeMermaidLabel(label)}"}`,
  )

  // Quote unquoted edge labels per line (skip lines that already use quoted edges)
  text = text
    .split('\n')
    .map(line => {
      if (/--\s*"/.test(line)) return line
      return line.replace(
        /--\s*([^->|\n]+?)\s*-->/g,
        (_, label) => `-- "${escapeMermaidLabel(label.trim())}" -->`,
      )
    })
    .join('\n')

  // Subgraph titles must be quoted if they contain special chars
  text = text.replace(
    /subgraph\s+([^\n\["]+)/gi,
    (match, title) => {
      const trimmed = title.trim()
      if (trimmed.startsWith('"')) return match
      return `subgraph "${escapeMermaidLabel(trimmed)}"`
    },
  )

  return text
}

function escapeMermaidLabel(label) {
  return String(label)
    .trim()
    .replace(/"/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
}
