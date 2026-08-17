"""
overview_service.py — Generate repository overview, tech stack, and architecture
                      using Gemini.
"""
import json
import logging

from django.conf import settings

from apps.common.genai_client import get_genai_client
from .mermaid_utils import sanitize_mermaid_diagram

logger = logging.getLogger(__name__)

# Files patterns to prioritise for context sampling
PRIORITY_PATTERNS = [
    'readme', 'package.json', 'requirements.txt', 'pyproject.toml',
    'settings', 'config', 'main', 'index', 'app', 'setup.py',
    'docker', 'makefile', 'manage.py', 'urls', 'router',
]


def _select_sample_files(files: list[dict], max_files: int = 20) -> list[dict]:
    """Return a prioritised subset of files for the overview prompt."""
    seen_paths: set[str] = set()
    selected: list[dict] = []

    # Priority pass
    for pattern in PRIORITY_PATTERNS:
        for f in files:
            path_lower = f['path'].lower()
            if pattern in path_lower and f['path'] not in seen_paths:
                selected.append(f)
                seen_paths.add(f['path'])
                if len(selected) >= max_files:
                    return selected

    # Fill remaining slots
    for f in files:
        if f['path'] not in seen_paths:
            selected.append(f)
            seen_paths.add(f['path'])
            if len(selected) >= max_files:
                break

    return selected


_FALLBACK_OVERVIEW = {
    "summary": "Repository analysed successfully.",
    "tech_stack": {},
    "languages": [],
    "important_components": [],
    "learning_path": [],
    "architecture_diagram": "flowchart TD\n  A[\"Entry Point\"] --> B[\"Core Logic\"]\n  B --> C[\"Data Layer\"]",
}


def generate_overview(repo_name: str, files: list[dict], folder_structure: str) -> dict:
    """
    Call Gemini to produce a structured JSON overview of the repository.
    Returns a dict with keys: summary, tech_stack, languages,
    important_components, learning_path, architecture_diagram.
    """
    client = get_genai_client()

    sample = _select_sample_files(files)
    file_dump = "\n\n".join(
        f"=== {f['path']} ===\n{f['content'][:1500]}"
        for f in sample
    )

    prompt = f"""You are an expert software architect performing a deep analysis of a GitHub repository.

Repository name: {repo_name}

Directory tree:
{folder_structure}

Selected source files:
{file_dump}

Analyse this repository thoroughly and return ONLY a single valid JSON object — no markdown, no code fences — with exactly these keys:

{{
  "summary": "<2–3 sentence plain-English description of what this project does>",
  "tech_stack": {{
    "frontend":  ["<lib/framework>", ...],
    "backend":   ["<lib/framework>", ...],
    "database":  ["<db>", ...],
    "testing":   ["<tool>", ...],
    "devops":    ["<tool>", ...]
  }},
  "languages": ["Python", "JavaScript", ...],
  "important_components": [
    {{"name": "<filename or dir>", "description": "<what it does>"}},
    ...
  ],
  "learning_path": ["README.md", "settings.py", "urls.py", "..."],
  "architecture_diagram": "<valid Mermaid flowchart TD string — ALL node and edge labels MUST be in double quotes>"
}}

Rules:
- tech_stack categories may be empty arrays if not applicable.
- architecture_diagram MUST use flowchart TD (not graph TD).
- Every node label MUST be quoted: A["My Service (API)"], never A[My Service (API)].
- Every edge label MUST be quoted: A -- "calls" --> B
- Do NOT use semicolons at end of lines.
- Return exactly one JSON object, nothing else.
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()

        # Strip markdown fences if present
        if raw.startswith('```'):
            raw = raw[raw.index('\n') + 1:]
        if raw.endswith('```'):
            raw = raw[:raw.rindex('```')]

        result = json.loads(raw)
        if result.get('architecture_diagram'):
            result['architecture_diagram'] = sanitize_mermaid_diagram(result['architecture_diagram'])
        return result
    except json.JSONDecodeError as exc:
        logger.error("JSON parse error in overview response: %s", exc)
        return {**_FALLBACK_OVERVIEW, "summary": f"Repository: {repo_name}"}
    except Exception as exc:
        logger.error("Overview generation failed: %s", exc)
        return {**_FALLBACK_OVERVIEW, "summary": f"Repository: {repo_name}"}
