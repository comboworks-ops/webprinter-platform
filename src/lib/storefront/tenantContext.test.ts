import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tenantContext from "./tenantContext.ts";
import { customerShopTarget } from "../account/shop.ts";

const MASTER_ID = tenantContext.MASTER_STOREFRONT_TENANT_ID;
const SHOP_ID = "9c919bbc-2f10-4daa-80f6-5818c93055d3";
const PIN_KEY = "wp_local_storefront_tenant";

test("shop settings keys distinguish storefront, admin, local lookup and draft preview behavior", () => {
  assert.notEqual(tenantContext.shopSettingsRouteScope("/", false), tenantContext.shopSettingsRouteScope("/admin", false));
  assert.notEqual(tenantContext.shopSettingsRouteScope("/", false), tenantContext.shopSettingsRouteScope("/local-tenant", false));
  assert.notEqual(tenantContext.shopSettingsRouteScope("/preview-shop", true), tenantContext.shopSettingsRouteScope("/preview-shop", false));
  assert.equal(tenantContext.shopSettingsRouteScope("/shop/product", false), tenantContext.shopSettingsRouteScope("/", false));
});

test("an explicit demo choice outranks the stored tenant, while bare storefront navigation retains the demo pin", () => {
  assert.equal(tenantContext.storefrontPinContextId({ honorPin: true, pinnedTenantId: SHOP_ID, forceTenantId: MASTER_ID }), null);
  assert.equal(tenantContext.storefrontPinContextId({ honorPin: true, pinnedTenantId: MASTER_ID }), MASTER_ID);
  assert.equal(tenantContext.storefrontPinContextId({ honorPin: false, pinnedTenantId: MASTER_ID }), null);
});

test("catalogs require resolved settings and cannot reuse another tenant or site context", () => {
  assert.equal(tenantContext.resolveCatalogTenantId({ isLoading: true, isError: false, data: { id: MASTER_ID } }), null);
  assert.equal(tenantContext.resolveCatalogTenantId({ isLoading: false, isError: true, data: { id: SHOP_ID } }), null);
  assert.equal(tenantContext.resolveCatalogTenantId({ isLoading: false, isError: false }), null);
  assert.equal(tenantContext.resolveCatalogTenantId({ isLoading: false, isError: false, data: { id: MASTER_ID } }), MASTER_ID);
  assert.notEqual(tenantContext.storefrontCatalogContextKey(MASTER_ID), tenantContext.storefrontCatalogContextKey(SHOP_ID));
  assert.notEqual(tenantContext.storefrontCatalogContextKey(SHOP_ID), tenantContext.storefrontCatalogContextKey(SHOP_ID, "other-site"));
});

// Execute the real hook's query function with storage and read-only backend responses.
// No React renderer, network connection, credentials or hosted data are used here.
type SimulatedBrowser = {
  location: { hostname: string; pathname: string; search: string };
  localStorage: Map<string, string>;
};
type TenantResponse = { data: unknown; error: unknown };

function settingsHarness(options: {
  search?: string;
  pathname?: string;
  pin?: string;
  cachedSettings?: Record<string, unknown>;
  tenantResponse?: TenantResponse | Promise<TenantResponse>;
  browser?: SimulatedBrowser;
}) {
  const browser = options.browser || {
    location: { hostname: "127.0.0.1", pathname: options.pathname || "/", search: options.search || "" },
    localStorage: new Map<string, string>(),
  };
  const localStorage = browser.localStorage;
  const sessionStorage = new Map<string, string>();
  if (options.pin) localStorage.set(PIN_KEY, JSON.stringify({ id: options.pin }));
  for (const [id, settings] of Object.entries(options.cachedSettings || {})) {
    sessionStorage.set(`wp_storefront_settings:tenant:${id}`, JSON.stringify(settings));
  }
  const calls: unknown[] = [];
  let queryOptions: any;
  const makeStorage = (data: Map<string, string>) => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  const queryChain = {
    select() { return this; },
    eq(column: string, value: string) { calls.push({ column, value }); return this; },
    in(column: string, value: string[]) { calls.push({ column, value }); return this; },
    maybeSingle: async () => options.tenantResponse || { data: null, error: null },
  };
  const dependencies: Record<string, unknown> = {
    "react": { useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}], useEffect: () => {}, useMemo: (fn: () => unknown) => fn() },
    "react-router-dom": { useLocation: () => ({ pathname: options.pathname || "/", search: options.search || "" }) },
    "@tanstack/react-query": { useQuery: (value: unknown) => { queryOptions = value; return {}; } },
    "@/hooks/useBrandingDraft": { mergeBrandingWithDefaults: (value: unknown) => value },
    "@/integrations/supabase/client": { supabase: { from: () => queryChain } },
    "@/lib/api/featureFlags": { USE_API_TENANT_CONTEXT: false },
    "@/lib/api/tenantContext": { fetchTenantContext: () => { throw new Error("Unexpected API lookup"); } },
    "@/lib/branding/settings-persistence": { extractPublishedBranding: (value: any) => value.branding },
    "@/lib/storefront/tenantContext": tenantContext,
    "@/lib/account/shop": { customerShopTarget },
  };
  const source = readFileSync(new URL("../../hooks/useShopSettings.ts", import.meta.url), "utf8").replace(/import\.meta\.env/g, "({})");
  const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const moduleExports: any = {};
  runInNewContext(transpiled, {
    exports: moduleExports,
    require: (name: string) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
    window: { location: browser.location, localStorage: makeStorage(localStorage), sessionStorage: makeStorage(sessionStorage), dispatchEvent() {} },
    URLSearchParams, Event, console: { log() {}, warn() {} },
  });
  moduleExports.useShopSettings();
  return { queryOptions, calls, localStorage, browser, runQuery: (signal = new AbortController().signal) => queryOptions.queryFn({ signal }) };
}

test("the actual settings query persists an explicitly selected master demo", async () => {
  const harness = settingsHarness({ search: `?tenantId=${MASTER_ID}`, pin: SHOP_ID, tenantResponse: { data: { id: MASTER_ID, name: "Webprinter demo" }, error: null } });
  const settings = await harness.runQuery();
  assert.equal(settings.id, MASTER_ID);
  assert.equal(JSON.parse(harness.localStorage.get(PIN_KEY)!).id, MASTER_ID);
  assert.deepEqual(harness.calls, [{ column: "id", value: MASTER_ID }]);
});

test("an unavailable explicit tenant fails without querying the pinned or master shop", async () => {
  const harness = settingsHarness({ search: `?tenantId=${SHOP_ID}`, pin: MASTER_ID });
  await assert.rejects(harness.runQuery(), /valgte shop/);
  assert.deepEqual(harness.calls, [{ column: "id", value: SHOP_ID }]);
});

test("a localhost network failure reuses only the matching pin cache", async () => {
  const harness = settingsHarness({ pin: SHOP_ID, cachedSettings: { [SHOP_ID]: { id: SHOP_ID, tenant_name: "Shop" }, [MASTER_ID]: { id: MASTER_ID, tenant_name: "Demo" } }, tenantResponse: { data: null, error: { message: "Failed to fetch" } } });
  assert.equal((await harness.runQuery()).id, SHOP_ID);
  const noMatchingCache = settingsHarness({ pin: SHOP_ID, cachedSettings: { [MASTER_ID]: { id: MASTER_ID } }, tenantResponse: { data: null, error: { message: "Failed to fetch" } } });
  await assert.rejects(noMatchingCache.runQuery(), /transport failure/);
});

test("the actual settings query key separates admin, storefront and changed pins", () => {
  const storefront = settingsHarness({ pin: MASTER_ID });
  const admin = settingsHarness({ pin: MASTER_ID, pathname: "/admin" });
  const otherTenant = settingsHarness({ pin: SHOP_ID });
  assert.notEqual(JSON.stringify(storefront.queryOptions.queryKey), JSON.stringify(admin.queryOptions.queryKey));
  assert.notEqual(JSON.stringify(storefront.queryOptions.queryKey), JSON.stringify(otherTenant.queryOptions.queryKey));
});

test("a late tenant A response cannot replace B after navigation even while A still has observers", async () => {
  let resolveA!: (value: TenantResponse) => void;
  const tenantA = settingsHarness({ search: `?tenantId=${SHOP_ID}`, tenantResponse: new Promise((resolve) => { resolveA = resolve; }) });
  const pendingA = tenantA.runQuery();
  tenantA.browser.location.search = `?tenantId=${MASTER_ID}`;
  const tenantB = settingsHarness({ browser: tenantA.browser, search: `?tenantId=${MASTER_ID}`, tenantResponse: { data: { id: MASTER_ID, name: "Demo" }, error: null } });
  await tenantB.runQuery();
  resolveA({ data: { id: SHOP_ID, name: "Previous shop" }, error: null });
  await pendingA;
  assert.equal(JSON.parse(tenantA.localStorage.get(PIN_KEY)!).id, MASTER_ID);
  tenantA.browser.location.search = "";
  const bareRoot = settingsHarness({ browser: tenantA.browser, tenantResponse: { data: { id: MASTER_ID, name: "Demo" }, error: null } });
  assert.equal((await bareRoot.runQuery()).id, MASTER_ID);
  assert.deepEqual(bareRoot.calls, [{ column: "id", value: MASTER_ID }]);
});

test("a cancelled settings query cannot write a pin even if its old route is still current", async () => {
  let resolveTenant!: (value: TenantResponse) => void;
  const harness = settingsHarness({ search: `?tenantId=${SHOP_ID}`, pin: MASTER_ID, tenantResponse: new Promise((resolve) => { resolveTenant = resolve; }) });
  const controller = new AbortController();
  const pending = harness.runQuery(controller.signal);
  controller.abort();
  resolveTenant({ data: { id: SHOP_ID, name: "Previous shop" }, error: null });
  await pending;
  assert.equal(JSON.parse(harness.localStorage.get(PIN_KEY)!).id, MASTER_ID);
});

test("the settings query resolves a valid tenant subdomain through its exact stored domain", async () => {
  const harness = settingsHarness({ pathname: "/local-tenant", search: "?tenant_subdomain=salgsmapper", pin: MASTER_ID, tenantResponse: { data: { id: SHOP_ID, domain: "salgsmapper.webprinter.dk", name: "Salgsmapper" }, error: null } });
  assert.equal((await harness.runQuery()).id, SHOP_ID);
  assert.equal(JSON.parse(harness.localStorage.get(PIN_KEY)!).id, SHOP_ID);
  assert.equal(harness.calls.length, 1);
  assert.equal((harness.calls[0] as any).column, "domain");
  assert.deepEqual(Array.from((harness.calls[0] as any).value), ["salgsmapper.webprinter.dk", "salgsmapper.webprinter.dk", "www.salgsmapper.webprinter.dk"]);
});

test("invalid or unavailable tenant subdomains never select the pinned or master shop", async () => {
  for (const slug of ["", "bad.test", "-bad"]) {
    const harness = settingsHarness({ search: `?tenant_subdomain=${slug}`, pin: MASTER_ID });
    await assert.rejects(harness.runQuery(), /subdomæne/);
    assert.equal(harness.calls.length, 0);
  }
  const missing = settingsHarness({ search: "?tenant_subdomain=missing", pin: MASTER_ID });
  await assert.rejects(missing.runQuery(), /domæne/);
  assert.ok(missing.calls.every((call: any) => call.column === "domain"));
  assert.equal(JSON.parse(missing.localStorage.get(PIN_KEY)!).id, MASTER_ID);
});
