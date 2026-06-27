#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const functionsDir = path.join(root, "supabase", "functions");
const configPath = path.join(root, "supabase", "config.toml");

const localOnlyFunctions = new Set([
  "create-admin-user",
  "seed-folder-prices",
  "seed-generic-prices",
  "seed-product-prices",
  "setup-schema",
  "test-env",
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const functionNames = fs
  .readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

const config = fs.readFileSync(configPath, "utf8");
const failures = [];

for (const functionName of functionNames) {
  const sectionPattern = new RegExp(`\\[functions\\.${escapeRegExp(functionName)}\\]`);
  if (!sectionPattern.test(config)) {
    failures.push(`${functionName}: missing explicit [functions.${functionName}] config section`);
  }
}

for (const functionName of localOnlyFunctions) {
  const indexPath = path.join(functionsDir, functionName, "index.ts");
  const source = fs.readFileSync(indexPath, "utf8");
  if (!source.includes("requireLocalOnly(req)")) {
    failures.push(`${functionName}: missing requireLocalOnly(req) guard`);
  }
}

if (failures.length > 0) {
  console.error("Supabase function exposure check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Supabase function exposure check passed for ${functionNames.length} functions.`);
