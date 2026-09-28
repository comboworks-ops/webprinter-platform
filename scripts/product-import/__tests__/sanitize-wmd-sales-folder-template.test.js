import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY = path.resolve(DIRECTORY, "../../..");
const PYTHON_TEST = path.join(DIRECTORY, "test_sanitize_wmd_sales_folder_template.py");
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

function pythonExecutable() {
  const configured = process.env.WMD_SALES_FOLDER_SANITIZER_PYTHON;
  if (configured) return configured;
  const bundled = path.resolve(path.dirname(process.execPath), "../../python/bin/python3");
  return existsSync(bundled) ? bundled : "python3";
}

function runPythonSuite() {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), [PYTHON_TEST], {
      cwd: REPOSITORY,
      env: {
        ...process.env,
        PYTHONPYCACHEPREFIX: "/private/tmp/wmd-sales-folder-sanitizer-test-pycache",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    let timeout;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("Python sanitizer test output exceeded 4 MiB")));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => finish(() => resolve({
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    })));
    timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`Python sanitizer test exceeded ${TIMEOUT_MS} ms`)));
    }, TIMEOUT_MS);
  });
}

test("sales-folder PDF sanitizer passes its contract, preservation, and refusal suite", async () => {
  const result = await runPythonSuite();
  assert.equal(
    result.code,
    0,
    `Python sanitizer suite failed (signal=${result.signal || "none"})\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stderr, /Ran \d+ tests/);
  assert.match(result.stderr, /OK(?: \(skipped=\d+\))?\s*$/);
});
