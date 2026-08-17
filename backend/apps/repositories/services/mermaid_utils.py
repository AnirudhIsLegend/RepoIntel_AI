"""Sanitize LLM-generated Mermaid diagrams for reliable rendering."""
import re


def _escape_label(label: str) -> str:
    return (
        label.strip()
        .replace('"', "'")
        .replace('[', '(')
        .replace(']', ')')
    )


def sanitize_mermaid_diagram(raw: str) -> str:
    if not raw or not isinstance(raw, str):
        return ''

    text = raw.strip()
    text = re.sub(r'^```(?:mermaid)?\s*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n?```\s*$', '', text, flags=re.IGNORECASE).strip()

    lines = [line.rstrip().rstrip(';').rstrip() for line in text.replace('\r\n', '\n').split('\n')]
    text = '\n'.join(lines).strip()

    if not text:
        return ''

    if re.match(r'^graph\s+(TD|TB|LR|RL|BT|DT)', text, re.IGNORECASE):
        text = re.sub(r'^graph\s+', 'flowchart ', text, count=1, flags=re.IGNORECASE)
    elif not re.match(r'^flowchart\s+', text, re.IGNORECASE):
        text = f'flowchart TD\n{text}'

    text = re.sub(
        r'([A-Za-z_][\w-]*)\[([^\]"\n]+)\]',
        lambda m: f'{m.group(1)}["{_escape_label(m.group(2))}"]',
        text,
    )
    text = re.sub(
        r'([A-Za-z_][\w-]*)\(\(([^)"\n]+)\)\)',
        lambda m: f'{m.group(1)}(("{_escape_label(m.group(2))}"))',
        text,
    )
    text = re.sub(
        r'([A-Za-z_][\w-]*)\{([^}"\n]+)\}',
        lambda m: f'{m.group(1)}{{"{_escape_label(m.group(2))}"}}',
        text,
    )
    lines = []
    for line in text.split('\n'):
        if re.search(r'--\s*"', line):
            lines.append(line)
        else:
            lines.append(re.sub(
                r'--\s*([^->|\n]+?)\s*-->',
                lambda m: f'-- "{_escape_label(m.group(1))}" -->',
                line,
            ))
    text = '\n'.join(lines)

    def _quote_subgraph(match: re.Match) -> str:
        title = match.group(1).strip()
        if title.startswith('"'):
            return match.group(0)
        return f'subgraph "{_escape_label(title)}"'

    text = re.sub(r'subgraph\s+([^\n\["]+)', _quote_subgraph, text, flags=re.IGNORECASE)

    return text
