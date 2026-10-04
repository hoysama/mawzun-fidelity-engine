#!/usr/bin/env python3
"""Rewrite `/docs/section/slug` cross-links into repository-relative `.md` links.

GitHub treats a leading-slash path as site-absolute, so `/docs/reference/measurement`
404s there while the real file is `docs/reference/measurement.md`. The link has to be
relative to the file that carries it. Anchors are preserved.
"""

import os
import re
import sys

ROOT = "/root/.hermes/workspaces/mawzun-project"
PATTERN = re.compile(r"\]\((/docs/[^)#\s]+)(#[^)\s]*)?\)")

targets = []
for base, _dirs, files in os.walk(os.path.join(ROOT, "docs")):
    for name in files:
        if name.endswith(".md"):
            targets.append(os.path.join(base, name))
targets.append(os.path.join(ROOT, "README.md"))

changed_files = 0
changed_links = 0

for path in targets:
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if not PATTERN.search(text):
        continue

    file_dir = os.path.dirname(path)

    def replace(match: re.Match) -> str:
        global changed_links
        slug = match.group(1)[len("/docs/"):]
        anchor = match.group(2) or ""
        target = os.path.join(ROOT, "docs", slug + ".md")
        rel = os.path.relpath(target, file_dir).replace(os.sep, "/")
        if not rel.startswith("."):
            rel = "./" + rel
        changed_links += 1
        return f"]({rel}{anchor})"

    new_text = PATTERN.sub(replace, text)
    if new_text != text:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(new_text)
        changed_files += 1

print(f"files rewritten: {changed_files}")
print(f"links rewritten: {changed_links}")
if changed_links == 0:
    sys.exit(1)
