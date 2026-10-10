/**
 * Verifies that relative links in the project's Markdown files point at files that exist.
 * External URLs are not fetched. Run with `npm run docs:check-links`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const roots = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "ROADMAP.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "docs",
];
const files: string[] = [];

function collect(path: string) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) collect(join(path, entry));
  } else if (path.endsWith(".md")) {
    files.push(path);
  }
}
roots.forEach(collect);

const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const problems: string[] = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1] ?? "";
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [path] = target.split("#");
    if (!path) continue;
    const resolved = resolve(dirname(file), decodeURIComponent(path));
    if (!existsSync(resolved))
      problems.push(`${file}: broken link "${target}" (${relative(process.cwd(), resolved)})`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Checked ${files.length} Markdown files: all relative links resolve.`);
