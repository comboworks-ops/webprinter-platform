import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.app.json'), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram(config.fileNames, config.options);
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
}

// Keep the real ESLint rules and every src file. A baseline is debt, not a clean lint result.
const results = await new ESLint({ cwd: root }).lintFiles(['src']);
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts/quality/frontend-eslint-baseline.json'), 'utf8'));
const counts = new Map();
let errors = 0;
let warnings = 0;
for (const result of results) {
  errors += result.errorCount;
  warnings += result.warningCount;
  for (const message of result.messages) {
    const key = JSON.stringify([path.relative(root, result.filePath).split(path.sep).join('/'), message.ruleId, message.severity]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
}
const regressions = [...counts].filter(([key, count]) => count > (baseline.counts[key] || 0));
for (const [key, count] of regressions) {
  const [file, rule, severity] = JSON.parse(key);
  console.error(`${file}: ${rule || 'parser'} (${severity === 2 ? 'error' : 'warning'}) ${baseline.counts[key] || 0} -> ${count}`);
}
console.log(`TypeScript: ${diagnostics.length} errors. ESLint: ${errors} existing errors, ${warnings} warnings; ${regressions.length} regressions.`);
console.log('Run npm run lint for the unrestricted report. Reduce the baseline only after reviewing removed debt.');
process.exitCode = diagnostics.length || regressions.length ? 1 : 0;
