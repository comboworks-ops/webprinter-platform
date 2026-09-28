import test from "node:test";
import assert from "node:assert/strict";
import { buildSupplierJevRequest, createSupplierJevClient, parseSupplierJevResponse, SUPPLIER_JEV_MODEL } from "./supplierJev.ts";

const source = { title: "Präsentationsmappen", description: "Mappe mit Taschen, matt, beidseitig bedruckt (4/4)." };
const env = (name: string) => ({ SUPPLIER_JEV_ENABLED: "true", TYPESAFE_API_KEY: "test-key-never-real" })[name];
function responseFor(request: ReturnType<typeof buildSupplierJevRequest>, picks: Record<string, string> = {}) {
  const answers = Object.fromEntries(Object.entries(request.questions).map(([key, question]) => {
    const choice = picks[key] ?? (key === "category" ? "sales_folders" : "not_stated");
    return [key, { type: "choice", choice, confidence: 0.95, probabilities: Object.fromEntries(Object.keys(question.criteria).map(option => [option, option === choice ? 1 : 0])) }];
  }));
  return { model: SUPPLIER_JEV_MODEL, answers, usage: { input_tokens: 5_000, output_tokens: 20 } };
}
const mockFetch = (callback?: (body: ReturnType<typeof buildSupplierJevRequest>, init: RequestInit) => void): typeof fetch => async (url, init) => {
  assert.equal(url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(init?.redirect, "error");
  const body = JSON.parse(String(init?.body));
  callback?.(body, init!);
  return Response.json(responseFor(body));
};

test("only bounded extracted public text enters the model; notes/prices/HTML/credentials are excluded", () => {
  const input = { ...source, description: "x".repeat(10_000), note: "private note", price: 12, html: "<script>secret</script>", apiKey: "secret" };
  const request = buildSupplierJevRequest(input);
  assert.deepEqual(Object.keys(request.state), ["title", "description"]);
  assert.equal(request.state.description.length, 4_000);
  assert.equal(Object.keys(request.questions).length, 4);
  assert.ok(Object.keys(request.questions.category.criteria).includes("other"));
});

test("valid output is advisory, keeps provenance and uses reported token usage for estimated cost", () => {
  const request = buildSupplierJevRequest(source);
  const parsed = parseSupplierJevResponse(responseFor(request, { surface: "matte", print_sides: "double" }), request);
  assert.equal(parsed.category?.value, "sales_folders");
  assert.deepEqual(parsed.properties?.map(p => p.valueLabel), ["Mat overflade", "Dobbeltsidet tryk"]);
  assert.equal(parsed.usage?.estimatedCostUsd, 0.00021);
  assert.equal(parsed.source?.title, source.title);
  assert.equal(parsed.promptVersion, "supplier-preview-v1");
});

test("low confidence and no-match results require manual review; missing properties are not invented", () => {
  const request = buildSupplierJevRequest(source);
  const payload = responseFor(request, { category: "other" });
  const result = parseSupplierJevResponse(payload, request);
  assert.equal(result.category?.review, "uncertain");
  assert.deepEqual(result.properties, []);
  payload.answers.category.choice = "sales_folders";
  payload.answers.category.probabilities = Object.fromEntries(Object.keys(request.questions.category.criteria).map(k => [k, k === "sales_folders" ? 1 : 0]));
  payload.answers.category.confidence = 0.4;
  assert.equal(parseSupplierJevResponse(payload, request).category?.review, "uncertain");
});

for (const [name, mutate] of Object.entries({
  "unknown category": (p: any) => { p.answers.category.choice = "send_to_production"; },
  "unknown property": (p: any) => { p.answers.surface.choice = "run_shell"; },
  "missing answer": (p: any) => { delete p.answers.adhesive; },
  "invalid confidence": (p: any) => { p.answers.category.confidence = 1.5; },
  "invalid distribution": (p: any) => { p.answers.category.probabilities.other = 1; },
  "missing probability": (p: any) => { delete p.answers.category.probabilities.other; },
  "non-winning choice": (p: any) => { p.answers.category.choice = "other"; },
  "different model": (p: any) => { p.model = "jev-latest"; },
  "invalid usage": (p: any) => { p.usage.input_tokens = -1; },
})) {
  test(`rejects ${name}`, () => {
    const request = buildSupplierJevRequest(source);
    const payload = responseFor(request);
    mutate(payload);
    assert.throws(() => parseSupplierJevResponse(payload, request));
  });
}

test("disabled or missing key never contacts provider", async () => {
  for (const env of [() => undefined, (name: string) => name === "SUPPLIER_JEV_ENABLED" ? "true" : undefined]) {
    const client = createSupplierJevClient({ env, fetch: async () => { throw new Error("must not be called"); } });
    assert.equal((await client(source, "operator")).status, "disabled");
  }
});

test("repeated and concurrent requests are cached per operator", async () => {
  let calls = 0;
  const client = createSupplierJevClient({ env, fetch: mockFetch(() => { calls++; }) });
  await Promise.all([client(source, "a"), client(source, "a")]);
  await client(source, "a");
  assert.equal(calls, 1);
  await client(source, "b");
  assert.equal(calls, 2);
});

test("provider failure does not retry or leak its body", async () => {
  let count = 0;
  const client = createSupplierJevClient({ env, fetch: async () => { count++; return new Response("secret upstream detail", { status: 429 }); } });
  assert.deepEqual(await client(source, "a"), { status: "unavailable" });
  assert.equal(count, 1);
});

test("hung provider is aborted and returns fallback within a bounded time", async () => {
  let signal: AbortSignal | null | undefined;
  const client = createSupplierJevClient({ env, timeoutMs: 20, fetch: async (_, init) => { signal = init?.signal; return await new Promise(() => {}); } });
  assert.deepEqual(await client(source, "a"), { status: "unavailable" });
  assert.equal(signal?.aborted, true);
});

test("oversized provider response is rejected", async () => {
  const client = createSupplierJevClient({ env, fetch: async () => new Response("x".repeat(70_000)) });
  assert.deepEqual(await client(source, "a"), { status: "unavailable" });
});

test("twenty uncached calls exhaust warm-isolate operator budget until reset", async () => {
  let now = 0;
  let count = 0;
  const client = createSupplierJevClient({ env, now: () => now, fetch: mockFetch(() => { count++; }) });
  for (let i = 0; i < 20; i++) assert.equal((await client({ title: `Product ${i}` }, "a")).status, "ready");
  assert.equal((await client({ title: "21" }, "a")).status, "limited");
  assert.equal(count, 20);
  now += 3_600_001;
  assert.equal((await client({ title: "21" }, "a")).status, "ready");
});
