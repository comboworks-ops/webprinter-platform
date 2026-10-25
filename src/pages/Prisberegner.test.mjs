import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const directory = path.dirname(fileURLToPath(import.meta.url));
const stubs = {
  "@/hooks/useShopSettings": "export const useShopSettings=()=>({data:globalThis.__prisberegnerSettings});",
  "@/components/storefront/StorefrontContentPage": `import React from 'react'; export const StorefrontContentPage=({children})=>React.createElement('main',null,children);`,
  "./Shop": `import React from 'react'; export default function Shop(){return React.createElement('div',{'data-testid':'existing-shop'},'Existing shop');}`,
};
const bundled = await build({
  entryPoints: [path.join(directory, "Prisberegner.tsx")], bundle: true,
  write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  plugins: [{ name: "isolate-storefront-services", setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? {path:args.path,namespace:"fixture"} : undefined);
    builder.onLoad({ filter: /.*/, namespace:"fixture" }, args => ({contents:stubs[args.path],loader:"js"}));
  }}],
});
const filename = path.join(directory, "prisberegner-test.cjs");
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(directory);
compiled._compile(bundled.outputFiles[0].text, compiled.filename);
const Page = compiled.exports.default;
function render(settings) {
  globalThis.__prisberegnerSettings = settings;
  return new JSDOM(renderToStaticMarkup(React.createElement(Page))).window.document;
}

for (const settings of [undefined, null, {id:"another-tenant",tenant_name:"Onlinetryksager"}]) {
  test(`unknown or other tenant retains existing shop (${settings?.id ?? "unresolved"})`, () => {
    const document=render(settings);
    assert.ok(document.querySelector('[data-testid="existing-shop"]'));
    assert.equal(document.querySelector("article"),null);
  });
}

test("approved Onlinetryksager page retains every word, price and destination", () => {
  const document=render({id:"7cb851f5-c792-40b1-a79a-1f7c7b5f668c"});
  assert.equal(document.querySelectorAll("h1").length,1);
  const copy=[...document.querySelectorAll("article h1,article h2,article h3,article p,article li,article th,article td")].map(e=>e.textContent).join(" ").replace(/\s+/g," ").trim();
  // Frozen from the exact copy approved on 20 October 2026, independently of JSX.
  assert.equal(createHash("sha256").update(copy).digest("hex"),"02413cbef4a59f371af51a4f444ed6b40a570d2abd237f6d2af9b7bde75e5975");
  assert.deepEqual([...document.querySelectorAll("tbody tr")].map(row=>[...row.cells].map(c=>c.textContent)),[
    ["Flyers: A5, tryk på én side (4+0), 130 g blankt papir","50 stk.","111 kr.","49 kr.","160 kr."],
    ["Blokke: A6, 25 sider, 80 g naturligt hvidt offsetpapir, uden dækblad, limning i top","10 blokke","194 kr.","49 kr.","243 kr."],
    ["Plakater: A3, 4+0, 135 g mat papir","10 stk.","157 kr.","49 kr.","206 kr."],
  ]);
  assert.deepEqual([...document.querySelectorAll("article a")].map(a=>a.getAttribute("href")),[
    "https://www.onlinetryksager.dk/produkt/flyer-demand",
    "https://www.onlinetryksager.dk/produkt/blokke",
    "https://www.onlinetryksager.dk/produkt/standard-plakater",
    "https://www.onlinetryksager.dk/grafisk-vejledning",
    "https://www.onlinetryksager.dk/kontakt",
    "tel:71991110","mailto:support@onlinetryksager.dk",
  ]);
  const region=document.querySelector('[role="region"][aria-label="Priseksempler"]');
  assert.equal(region.tabIndex,0);
  assert.ok(region.classList.contains("overflow-x-auto"));
  assert.ok(document.querySelector("table").className.includes("min-w-[640px]"));
});
