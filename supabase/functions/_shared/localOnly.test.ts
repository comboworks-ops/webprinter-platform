import assert from "node:assert/strict";
import test from "node:test";
import { requireLocalOnly } from "./localOnly.ts";

const secret = "synthetic-local-test-secret-32-characters";
const local = {
  ALLOW_LOCAL_DEV_FUNCTIONS: "true",
  DEPLOYMENT_ENV: "local",
  LOCAL_FUNCTION_SECRET: secret,
  SUPABASE_URL: "http://kong:8000",
  SUPABASE_DB_URL: "postgresql://postgres:fixture@db:5432/postgres",
};

function check(overrides: Record<string, string | undefined>, providedSecret = secret) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  const env: Record<string, string | undefined> = { ...local, ...overrides };
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: { env: { get: (name: string) => env[name] } } });
  try {
    return requireLocalOnly(new Request("http://localhost/functions/v1/setup-schema", {
      method: "POST", headers: { "x-local-function-secret": providedSecret },
    }));
  } finally {
    if (previous) Object.defineProperty(globalThis, "Deno", previous);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
}

test("maintenance tools require explicit opt-in and a strong matching secret", () => {
  for (const flag of [undefined, "false", "0", ""]) assert.equal(check({ ALLOW_LOCAL_DEV_FUNCTIONS: flag })?.status, 403);
  for (const value of [undefined, "", "short"]) assert.equal(check({ LOCAL_FUNCTION_SECRET: value }, value || "")?.status, 403);
  assert.equal(check({}, "wrong-secret")?.status, 403);
  assert.equal(check({}), null);
});

test("hosted runtimes stay disabled even with local flags and the matching secret", () => {
  assert.equal(check({ DENO_DEPLOYMENT_ID: "hosted-deployment" })?.status, 403);
  for (const value of [undefined, "", "production", "prod", "preview", "staging"]) {
    assert.equal(check({ DEPLOYMENT_ENV: value })?.status, 403, String(value));
  }
  assert.equal(check({ ENVIRONMENT: "production" })?.status, 403);
});

test("local maintenance cannot target hosted API or database credentials", () => {
  for (const value of [undefined, "", "invalid", "https://example.supabase.co", "https://localhost.attacker.test", "file://localhost/api"]) {
    assert.equal(check({ SUPABASE_URL: value })?.status, 403, String(value));
  }
  for (const value of ["postgresql://db.example.supabase.co/postgres", "postgresql://db.attacker.test/db", "invalid"]) {
    assert.equal(check({ SUPABASE_DB_URL: value })?.status, 403, value);
  }
  for (const value of ["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321", "http://kong:8000"]) {
    assert.equal(check({ SUPABASE_URL: value }), null, value);
  }
});
