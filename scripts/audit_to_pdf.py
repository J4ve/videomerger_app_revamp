#!/usr/bin/env python
"""Convert docs/AUDIT.md to a styled PDF using headless Chromium.

Renders the markdown into a self-contained HTML file with print-friendly
CSS, then drives Chrome (or Edge as a fallback) in headless mode to
produce the PDF. No external Node/Pandoc/LaTeX install required.

Usage:
    python scripts/audit_to_pdf.py [--out path/to/audit.pdf]
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown  # type: ignore[import-not-found]

ROOT = Path(__file__).resolve().parents[1]
AUDIT_MD = ROOT / 'docs' / 'AUDIT.md'

CSS = """
@page {
  size: Letter;
  /* Top margin is larger than the rest so a header banner can be
     overlaid on every page after the PDF is generated (e.g. when
     stamping the school letterhead in Word, Acrobat, or a separate
     image editor). Adjust the first value if the banner size changes. */
  margin: 40mm 16mm 18mm 16mm;
}
body {
  font-family: 'Arial Narrow', 'Liberation Sans Narrow', 'Helvetica Neue', Arial, sans-serif;
  font-stretch: condensed;
  font-size: 11pt;
  line-height: 1.45;
  color: #1f1f1f;
}
.cover-meta {
  line-height: 1.55;
  margin: 6pt 0 12pt;
}
.cover-meta p {
  margin: 0;
}
h1 { font-size: 22pt; margin: 0 0 6pt; color: #000; }
h2 {
  font-size: 16pt;
  margin: 18pt 0 6pt;
  padding-bottom: 3pt;
  border-bottom: 1.5pt solid #333;
  color: #000;
  page-break-after: avoid;
}
h3 { font-size: 13pt; margin: 14pt 0 4pt; color: #000; page-break-after: avoid; }
h4 { font-size: 11.5pt; margin: 10pt 0 3pt; color: #000; page-break-after: avoid; }
p, li { font-size: 10.5pt; }
ul, ol { margin: 4pt 0 8pt 18pt; }
li { margin: 1pt 0; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 8pt 0 12pt;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th, td {
  border: 0.5pt solid #aaa;
  padding: 4pt 6pt;
  text-align: left;
  vertical-align: top;
}
th { background: #eaeaea; color: #000; font-weight: 600; }
code {
  font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
  font-size: 9.5pt;
  background: #f4f4f4;
  padding: 1pt 3pt;
  border-radius: 2pt;
}
pre {
  font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
  font-size: 9pt;
  background: #f4f4f4;
  padding: 6pt 8pt;
  border-left: 2pt solid #555;
  border-radius: 2pt;
  overflow-x: auto;
  line-height: 1.35;
  page-break-inside: avoid;
}
pre code { background: transparent; padding: 0; }
blockquote {
  border-left: 3pt solid #aac4e2;
  padding: 2pt 8pt;
  color: #444;
  margin: 6pt 0;
}
hr { border: none; border-top: 0.5pt solid #ccc; margin: 12pt 0; }
strong { color: #000; }
a { color: #000; text-decoration: underline; }
.cover {
  text-align: center;
  margin: 40pt 0 24pt;
}
.cover h1 {
  font-size: 26pt;
  border: none;
  margin-bottom: 4pt;
}
.cover .subtitle {
  font-size: 12pt;
  color: #555;
  margin-bottom: 16pt;
}
"""

HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <style>{css}</style>
  <style>
    /* Mermaid diagrams: center, give them room, and avoid being split across pages. */
    .mermaid {{
      text-align: center;
      page-break-inside: avoid;
      margin: 12pt 0;
    }}
  </style>
</head>
<body>
{body}
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  // Convert the fenced-code blocks emitted by the Python markdown engine
  // (<pre><code class="language-mermaid">...</code></pre>) into the
  // <div class="mermaid"> form mermaid.js expects, then initialize.
  document.querySelectorAll('pre > code.language-mermaid').forEach(function (code) {{
    var div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  }});
  mermaid.initialize({{ startOnLoad: false, theme: 'default', securityLevel: 'loose' }});
  // Render explicitly and signal completion so the print step can wait.
  mermaid.run().then(function () {{
    document.title = document.title + ' — ready';
    window.__mermaidReady = true;
  }}).catch(function (err) {{
    console.error('Mermaid render error:', err);
    window.__mermaidReady = true;
  }});
</script>
</body>
</html>
"""


def find_chromium() -> str:
    """Locate a usable Chrome / Edge for headless PDF rendering."""
    candidates = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        shutil.which('chrome'),
        shutil.which('msedge'),
        shutil.which('chromium'),
        shutil.which('google-chrome'),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    raise SystemExit(
        'No Chrome/Edge/Chromium binary found; cannot render PDF. '
        'Install Chrome or Edge and retry.'
    )


def render_pdf(md_path: Path, pdf_path: Path) -> None:
    if not md_path.exists():
        raise SystemExit(f'Markdown source not found: {md_path}')

    text = md_path.read_text(encoding='utf-8')

    md_engine = markdown.Markdown(
        extensions=['tables', 'fenced_code', 'toc', 'sane_lists', 'md_in_html'],
        output_format='html5',
    )
    body_html = md_engine.convert(text)

    html = HTML_TEMPLATE.format(
        title='VideoMerger Final Engineering Review',
        css=CSS,
        body=body_html,
    )

    # Render the temp HTML next to AUDIT.md so relative <img src="assets/...">
    # references in the source resolve against the same docs/ directory.
    # Using a leading dot keeps the temp file out of casual directory listings.
    html_path = md_path.parent / f'.audit_render_{os.getpid()}.html'
    html_path.write_text(html, encoding='utf-8')

    try:
        chromium = find_chromium()
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        # Use a fresh profile dir so we never collide with a running browser.
        with tempfile.TemporaryDirectory(prefix='audit_pdf_profile_') as profile:
            cmd = [
                chromium,
                '--headless=new',
                '--disable-gpu',
                '--no-sandbox',
                f'--user-data-dir={profile}',
                f'--print-to-pdf={pdf_path}',
                '--no-pdf-header-footer',
                # Let mermaid.js fetch from CDN and render before printing.
                # Without this, Chrome prints before the diagrams appear.
                '--virtual-time-budget=15000',
                '--run-all-compositor-stages-before-draw',
                f'file:///{html_path.as_posix()}',
            ]
            print(f'[audit_to_pdf] rendering via {chromium}')
            result = subprocess.run(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, timeout=120,
            )
            if result.returncode != 0:
                print(result.stdout)
                print(result.stderr, file=sys.stderr)
                raise SystemExit(
                    f'Chromium exited with code {result.returncode}'
                )
        print(f'[audit_to_pdf] wrote {pdf_path}')
    finally:
        try:
            html_path.unlink()
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--out',
        default=str(ROOT / 'docs' / 'AUDIT.pdf'),
        help='Output PDF path (default: docs/AUDIT.pdf)',
    )
    parser.add_argument(
        '--src',
        default=str(AUDIT_MD),
        help='Markdown source path (default: docs/AUDIT.md)',
    )
    args = parser.parse_args()
    render_pdf(Path(args.src), Path(args.out))


if __name__ == '__main__':
    main()
