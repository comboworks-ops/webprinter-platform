#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

const LOG_FILE = path.resolve(process.cwd(), "docs/PUSH_READY_LOG.md");
const SAFE_REF_RE = /^[A-Za-z0-9._/-]+$/;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function parseArgs(argv) {
  const noteIndex = argv.indexOf("--note");
  const note =
    noteIndex !== -1 && argv[noteIndex + 1]
      ? argv[noteIndex + 1]
      : "Approved by user to push to GitHub";
  const toMain = argv.includes("--to-main");
  const fromIndex = argv.indexOf("--from");
  const fromBranch =
    fromIndex !== -1 && argv[fromIndex + 1] ? argv[fromIndex + 1] : null;
  return { note, toMain, fromBranch };
}

function ensureLogFile() {
  if (fs.existsSync(LOG_FILE)) return;
  const initial = [
    "# Push Ready Log",
    "",
    "Use this log when a change is approved and ready to push to GitHub.",
    "",
  ].join("\n");
  fs.writeFileSync(LOG_FILE, initial, "utf8");
}

function main() {
  const { note, toMain, fromBranch } = parseArgs(process.argv);

  const timestamp = new Date().toISOString();
  const currentBranch = run("git rev-parse --abbrev-ref HEAD");
  const branch = fromBranch || currentBranch;
  const commit = run("git rev-parse --short HEAD");
  const shortStatus = run("git status --short");
  const treeState = shortStatus && shortStatus !== "unknown" ? "dirty" : "clean";

  ensureLogFile();

  let entry = "";

  if (toMain) {
    const safeBranch = SAFE_REF_RE.test(branch) ? branch : "unknown";
    const aheadOfMain =
      safeBranch !== "unknown" ? run(`git rev-list --count main..${safeBranch}`) : "unknown";

    entry =
      `- ${timestamp} | action \`merge-to-main\` | from \`${safeBranch}\` | target \`main\` | ` +
      `commit \`${commit}\` | tree \`${treeState}\` | ahead_of_main \`${aheadOfMain}\` | note: ${note}`;

    console.log("Merge-to-main notification logged.");
    if (safeBranch === "main") {
      console.log("Current branch is already main.");
    } else {
      console.log(`Branch '${safeBranch}' is pending merge consideration into main.`);
    }
  } else {
    entry = `- ${timestamp} | action \`push-ready\` | branch \`${branch}\` | commit \`${commit}\` | tree \`${treeState}\` | note: ${note}`;
    console.log("Push-ready notification logged.");
  }

  fs.appendFileSync(LOG_FILE, `${entry}\n`, "utf8");

  console.log(entry);
  console.log(`Log file: ${LOG_FILE}`);
}

main();
