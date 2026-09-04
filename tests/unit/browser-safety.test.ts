// tests/unit/browser-safety.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Fitness test: a lib é consumida no navegador pelo Atlas (execução assistida,
 * fsa-tools/web3#11). Nada em `src/` pode depender do runtime Node — nem no
 * caminho de encode/assinatura, nem no de leitura. Falha aqui é regressão de
 * portabilidade, não de estilo.
 */

const SRC_ROOT = new URL("../../src", import.meta.url).pathname;

const NODE_ONLY_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: 'import de "node:*"', regex: /from\s+["']node:/ },
  {
    name: "import de módulo built-in do Node",
    regex: /from\s+["'](fs|path|crypto|os|http|https|net|stream|worker_threads|child_process)["']/,
  },
  { name: "require() (CJS)", regex: /\brequire\s*\(/ },
  { name: "process.*", regex: /\bprocess\s*\./ },
  { name: "Buffer", regex: /\bBuffer\b/ },
  { name: "__dirname / __filename", regex: /\b__(dirname|filename)\b/ },
];

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("browser safety", () => {
  const files = listTsFiles(SRC_ROOT);

  it("encontra os arquivos de src/ para varrer", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("nenhum arquivo de src/ depende do runtime Node", () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return NODE_ONLY_PATTERNS.filter(({ regex }) => regex.test(source)).map(
        ({ name }) => `${relative(SRC_ROOT, file)}: ${name}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
