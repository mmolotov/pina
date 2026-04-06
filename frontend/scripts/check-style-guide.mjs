import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, "app");

const ignoredSegments = new Set(["test"]);
const ignoredSuffixes = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
const allowedLiteralFiles = new Set([
  path.join("app", "app.css"),
  path.join("app", "routes", "accessibility.test.tsx"),
]);

const forbiddenPatterns = [
  {
    label: "hex color literal",
    regex: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    label: "rgb/hsl color function",
    regex: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g,
  },
  {
    label: "raw arbitrary Tailwind color value",
    regex:
      /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[(?:#|rgb|rgba|hsl|hsla)/g,
  },
];

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredSegments.has(entry.name)) {
        continue;
      }
      files.push(...(await collectFiles(nextPath)));
      continue;
    }

    if (!/\.(ts|tsx|css)$/.test(entry.name)) {
      continue;
    }
    if (ignoredSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
      continue;
    }

    files.push(nextPath);
  }

  return files;
}

function toLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

async function main() {
  const files = await collectFiles(appRoot);
  const violations = [];

  for (const absoluteFile of files) {
    const relativeFile = path.relative(projectRoot, absoluteFile);
    if (allowedLiteralFiles.has(relativeFile)) {
      continue;
    }

    const source = await fs.readFile(absoluteFile, "utf8");

    for (const pattern of forbiddenPatterns) {
      for (const match of source.matchAll(pattern.regex)) {
        const line = toLineNumber(source, match.index ?? 0);
        violations.push(
          `${relativeFile}:${line} uses ${pattern.label} (${match[0]}).`,
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      [
        "Style guide conformance check failed.",
        "Raw color literals are only allowed inside app/app.css.",
        ...violations.map((line) => `- ${line}`),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    "Style guide conformance check passed: no raw color literals outside app/app.css.",
  );
}

await main();
