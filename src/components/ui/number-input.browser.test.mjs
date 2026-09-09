import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createRequire } from "node:module";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");

const root = fileURLToPath(new URL("../../../", import.meta.url));
let browser;
let page;
let fixtureScript;

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NumberInput } from './src/components/ui/number-input.tsx';
function Fixture() {
  const [value, setValue] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [other, setOther] = useState(0);
  const [focused, setFocused] = useState(false);
  return React.createElement('main', null,
    React.createElement(NumberInput, { id: 'cost', value, step: 0.01, onValueChange: setValue, onFocus: () => setFocused(true), onBlur: () => setFocused(false) }),
    React.createElement('output', { id: 'value' }, String(value)),
    React.createElement('output', { id: 'focused' }, String(focused)),
    React.createElement(NumberInput, { id: 'quantity', value: quantity, emptyValue: 1, min: 1, onValueChange: v => setQuantity(Math.max(1, Math.floor(v))) }),
    React.createElement('output', { id: 'quantity-value' }, String(quantity)),
    React.createElement(NumberInput, { id: 'other', value: other, onValueChange: setOther }),
    React.createElement('button', { id: 'reset', onClick: () => setValue(72.5) }, 'Reset'),
    React.createElement('button', { id: 'rerender', onMouseDown: e => e.preventDefault(), onClick: () => setOther(v => v + 1) }, 'Rerender')
  );
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;

before(async () => {
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: fixture, resolveDir: root, loader: "jsx" },
    alias: { "@": path.join(root, "src") },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '\"development\"' },
  });
  fixtureScript = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
});

beforeEach(async () => {
  await page.goto("about:blank");
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixtureScript });
  await page.locator("#cost").waitFor();
});

after(async () => {
  await browser?.close();
});

test("zero can be cleared and replaced without reappearing", async () => {
  const field = page.locator("#cost");
  await field.focus();
  await field.press("End");
  await field.press("Backspace");
  assert.equal(await field.inputValue(), "");
  assert.equal(await page.locator("#value").textContent(), "0");
  await field.pressSequentially("125");
  assert.equal(await field.inputValue(), "125");
  assert.equal(await page.locator("#value").textContent(), "125");
});

test("decimal typing preserves intermediate draft text and numeric calculation", async () => {
  const field = page.locator("#cost");
  await field.fill("");
  await field.pressSequentially("0.25");
  assert.equal(await field.inputValue(), "0.25");
  assert.equal(await page.locator("#value").textContent(), "0.25");
  await field.press("Tab");
  assert.equal(await field.inputValue(), "0.25");
});

test("blank is retained through unrelated parent renders", async () => {
  const field = page.locator("#cost");
  await field.fill("");
  await page.locator("#rerender").click();
  assert.equal(await field.inputValue(), "");
});

test("leaving an empty field restores its numeric fallback and forwards blur", async () => {
  const field = page.locator("#cost");
  await field.fill("");
  assert.equal(await page.locator("#focused").textContent(), "true");
  await field.press("Tab");
  assert.equal(await field.inputValue(), "0");
  assert.equal(await page.locator("#focused").textContent(), "false");
});

test("external reset replaces edited state", async () => {
  await page.locator("#cost").fill("12.5");
  await page.locator("#reset").click();
  assert.equal(await page.locator("#cost").inputValue(), "72.5");
  assert.equal(await page.locator("#value").textContent(), "72.5");
});

test("minimum-one quantity remains clearable without changing its calculation rule", async () => {
  const field = page.locator("#quantity");
  await field.fill("");
  assert.equal(await field.inputValue(), "");
  assert.equal(await page.locator("#quantity-value").textContent(), "1");
  await field.pressSequentially("250");
  assert.equal(await field.inputValue(), "250");
  assert.equal(await page.locator("#quantity-value").textContent(), "250");
});
