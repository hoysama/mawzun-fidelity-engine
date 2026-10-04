#!/usr/bin/env node
/**
 * Documentation integrity check.
 *
 * Verifies that every file under `docs/` (except the landing `docs/README.md`)
 * carries a complete front-matter block (`title`, `description`, `order`), that
 * no two pages in the same section share an `order`, and that every internal
 * `/docs/...` link points at an existing page.
 *
 * Run with: `bun run docs:check`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCS_ROOT = path.join(REPO_ROOT, "docs");

/** Sections are the `##` headings; the order of files under each section is
 *  set by the page front-matter's `order` field. */
const SECTIONS = ["getting-started", "architecture", "workflow", "reference", "adr"];

/** Minimal front-matter reader — same flat `key: value` contract as the app. */
function parseFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---")) return { data: {}, content: normalized };
  const closing = normalized.indexOf("\n---", 3);
  if (closing === -1) return { data: {}, content: normalized };
  const block = normalized.slice(3, closing).trim();
  const data = {};
  for (const line of block.split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    let value = line.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
    data[line.slice(0, sep).trim()] = value;
  }
  return { data, content: normalized };
}

const errors = [];
const slugs = new Set();
const docs = [];

for (const section of SECTIONS) {
  const dir = path.join(DOCS_ROOT, section);
  if (!fs.existsSync(dir)) {
    errors.push(`missing section directory: docs/${section}/`);
    continue;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) errors.push(`empty section: docs/${section}/`);
  const orders = new Map();
  for (const file of files) {
    const slug = `${section}/${file.replace(/\.md$/, "")}`;
    slugs.add(`/docs/${slug}`);
    const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
    docs.push({ file: `docs/${slug}.md`, data });
    for (const key of ["title", "description", "order"]) {
      if (!data[key]) errors.push(`${slug}.md: missing front-matter "${key}"`);
    }
    if (data.order !== undefined) {
      if (!/^\d+$/.test(String(data.order).trim())) {
        errors.push(`${slug}.md: "order" must be an integer (got "${data.order}")`);
      } else if (orders.has(data.order)) {
        errors.push(
          `${slug}.md: duplicate order "${data.order}" (also used by ${orders.get(data.order)})`,
        );
      } else {
        orders.set(data.order, `${slug}.md`);
      }
    }
  }
}

/**
 * Internal links are repository-relative paths ending in `.md`, because that is
 * the only form that resolves when a reader browses the repository: a
 * leading-slash path is site-absolute, so `/docs/reference/measurement` 404s
 * while `../reference/measurement.md` opens. Each link is resolved against the
 * directory of the file carrying it, the way a viewer does.
 */
const pageFiles = new Set(docs.map((doc) => doc.file));
pageFiles.add("docs/README.md");
pageFiles.add("README.md");

const linkPattern = /\]\((\.{0,2}\/[^)#\s]+\.md)(#[^)\s]*)?\)/g;

for (const file of [...docs.map((doc) => doc.file), "docs/README.md", "README.md"]) {
  const full = path.join(REPO_ROOT, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const match of text.matchAll(linkPattern)) {
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), match[1]),
    );
    if (!pageFiles.has(resolved)) {
      errors.push(`${file}: broken internal link "${match[1]}" (resolves to ${resolved})`);
    }
  }
}

if (errors.length > 0) {
  console.error(`\n✖ docs:check failed with ${errors.length} problem(s):\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ docs:check passed — ${docs.length} pages across ${SECTIONS.length} sections.`);
