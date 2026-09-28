import assert from "node:assert/strict";
import test from "node:test";
import {readSupabaseKey} from "./supabaseKeys.ts";
const env = (values: Record<string, string>) => (name: string) => values[name];

test("hosted modern dictionaries replace legacy public and server keys independently", () => {
  const read = env({SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_test"}',
    SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}',
    SUPABASE_ANON_KEY: "old-anon", SUPABASE_SERVICE_ROLE_KEY: "old-service"});
  assert.equal(readSupabaseKey(read, "publishable"), "sb_publishable_test");
  assert.equal(readSupabaseKey(read, "secret"), "sb_secret_test");
});
test("server and CLI singular configuration is supported without a VITE private fallback", () => {
  assert.equal(readSupabaseKey(env({SUPABASE_SECRET_KEY: "sb_secret_server"}), "secret"), "sb_secret_server");
  assert.equal(readSupabaseKey(env({VITE_SUPABASE_SERVICE_ROLE_KEY: "private"}), "secret"), undefined);
});
test("named keys require the exact configured name", () => {
  const values = {SUPABASE_SECRET_KEYS: '{"worker":"sb_secret_worker"}'};
  assert.throws(() => readSupabaseKey(env(values), "secret"), /configuration_invalid/);
  assert.equal(readSupabaseKey(env({...values, WEBPRINTER_SUPABASE_SECRET_KEY_NAME: "worker"}), "secret"), "sb_secret_worker");
});
test("bad modern configuration fails closed and errors never expose its contents", () => {
  for (const value of ['bad-sensitive-json', 'null', '[]', '{}', '{"default":"sb_publishable_wrong"}',
    '{"default":7}', '{"default":"sb_secret_"}', '{"default":"sb_secret_has space"}']) {
    assert.throws(() => readSupabaseKey(env({SUPABASE_SECRET_KEYS:value, SUPABASE_SERVICE_ROLE_KEY:"old"}), "secret"),
      error => error instanceof Error && error.message === "supabase_key_configuration_invalid");
  }
  assert.throws(() => readSupabaseKey(env({SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_secret_private"}'}), "publishable"));
});
test("legacy fallback is explicit and can be disabled for migration acceptance", () => {
  const values = {SUPABASE_SERVICE_ROLE_KEY: "legacy"};
  assert.equal(readSupabaseKey(env(values), "secret"), "legacy");
  assert.throws(() => readSupabaseKey(env({...values, WEBPRINTER_REQUIRE_MODERN_SUPABASE_KEYS:"true"}), "secret"));
  assert.throws(() => readSupabaseKey(env({...values, DENO_DEPLOYMENT_ID:"hosted-function-1"}), "secret"));
});
