"""
git_service.py — Clone GitHub repositories and parse source files.
"""
import logging
import shutil
from pathlib import Path

import git
from django.conf import settings

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.md', '.json'}

IGNORED_DIRS = {
    'node_modules', 'dist', 'build', '.git', 'venv', '.venv', '__pycache__',
    '.pytest_cache', '.next', 'coverage', '.cache', '.idea', '.vscode',
    'env', '.tox', 'site-packages', 'eggs', '.eggs', 'htmlcov',
}

IGNORED_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 
    'Pipfile.lock', 'Gemfile.lock', 'Cargo.lock', 'composer.lock'
}

LANGUAGE_MAP = {
    '.py':   'Python',
    '.js':   'JavaScript',
    '.jsx':  'JavaScript/React',
    '.ts':   'TypeScript',
    '.tsx':  'TypeScript/React',
    '.html': 'HTML',
    '.css':  'CSS',
    '.md':   'Markdown',
    '.json': 'JSON',
}

MAX_FILE_SIZE_BYTES = 512 * 1024   # 512 KB per file
MAX_FILES = 250                    # Cap to keep indexing manageable


def _repos_dir() -> Path:
    d = Path(settings.BASE_DIR) / 'cloned_repos'
    d.mkdir(exist_ok=True)
    return d


def clone_repository(github_url: str, repo_id: int) -> str:
    """Clone a public GitHub repository and return the local path string."""
    repo_path = _repos_dir() / str(repo_id)
    if repo_path.exists():
        shutil.rmtree(repo_path)

    logger.info("Cloning %s → %s", github_url, repo_path)
    git.Repo.clone_from(github_url, str(repo_path), depth=1)   # shallow clone for speed
    return str(repo_path)


def _is_ignored(path: Path, base: Path) -> bool:
    """Return True if the path is inside any ignored directory."""
    try:
        parts = path.relative_to(base).parts
    except ValueError:
        return False
    return any(part in IGNORED_DIRS or part.startswith('.') for part in parts[:-1])


def parse_repository(repo_path: str) -> list[dict]:
    """
    Walk the repo and return a list of dicts:
      {path, content, language}
    """
    base = Path(repo_path)
    files: list[dict] = []

    for file_path in sorted(base.rglob('*')):
        if len(files) >= MAX_FILES:
            logger.warning("Hit MAX_FILES cap (%d) — skipping the rest.", MAX_FILES)
            break

        if not file_path.is_file():
            continue
        if file_path.name in IGNORED_FILES:
            continue
        if file_path.suffix not in SUPPORTED_EXTENSIONS:
            continue
        if _is_ignored(file_path, base):
            continue
        if file_path.stat().st_size > MAX_FILE_SIZE_BYTES:
            logger.debug("Skipping large file: %s", file_path)
            continue

        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            if not content.strip():
                continue
            files.append({
                'path':     str(file_path.relative_to(base)),
                'content':  content,
                'language': LANGUAGE_MAP.get(file_path.suffix, 'Unknown'),
            })
        except Exception as exc:
            logger.warning("Could not read %s: %s", file_path, exc)

    logger.info("Parsed %d files from %s", len(files), repo_path)
    return files


def get_folder_structure(repo_path: str, max_depth: int = 4) -> str:
    """Return a tree-style string representation of the repository layout."""
    base = Path(repo_path)
    lines: list[str] = [base.name + '/']

    def _walk(path: Path, prefix: str, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            entries = sorted(path.iterdir(), key=lambda e: (e.is_file(), e.name))
        except PermissionError:
            return

        visible = [e for e in entries
                   if e.name not in IGNORED_DIRS and e.name not in IGNORED_FILES and not e.name.startswith('.')]

        for i, entry in enumerate(visible):
            is_last = i == len(visible) - 1
            connector = '└── ' if is_last else '├── '
            suffix = '/' if entry.is_dir() else ''
            lines.append(f"{prefix}{connector}{entry.name}{suffix}")
            if entry.is_dir():
                _walk(entry, prefix + ('    ' if is_last else '│   '), depth + 1)

    _walk(base, '', 0)
    return '\n'.join(lines)


def cleanup_repository(repo_path: str) -> None:
    """Delete a cloned repository from disk."""
    try:
        shutil.rmtree(repo_path, ignore_errors=True)
        logger.info("Cleaned up %s", repo_path)
    except Exception as exc:
        logger.warning("Cleanup failed for %s: %s", repo_path, exc)


def get_repository_path(repo_id: int) -> Path:
    return _repos_dir() / str(repo_id)


def cleanup_repository_by_id(repo_id: int) -> None:
    """Delete the on-disk clone for a repository ID, if present."""
    path = get_repository_path(repo_id)
    if path.exists():
        cleanup_repository(str(path))
