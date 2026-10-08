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
import { Input } from './src/components/ui/input.tsx';
import { EditableNumberInput } from './src/components/ui/editable-number-input.tsx';
function Fixture() {
  const [value, setValue] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [other, setOther] = useState(0);
  const [focused, setFocused] = useState(false);
  const [plain, setPlain] = useState(100);
  const [clamped, setClamped] = useState(10);
  const [raw, setRaw] = useState(0);
  const [text, setText] = useState('hello');
  const fieldRef = React.useRef(null);
  return React.createElement('main', null,
    React.createElement(NumberInput, { id: 'cost', value, step: 0.01, onValueChange: setValue, onFocus: () => setFocused(true), onBlur: () => setFocused(false) }),
    React.createElement('output', { id: 'value' }, String(value)),
    React.createElement('output', { id: 'focused' }, String(focused)),
    React.createElement(NumberInput, { id: 'quantity', value: quantity, emptyValue: 1, min: 1, onValueChange: v => setQuantity(Math.max(1, Math.floor(v))) }),
    React.createElement('output', { id: 'quantity-value' }, String(quantity)),
    React.createElement(NumberInput, { id: 'other', value: other, onValueChange: setOther }),
    React.createElement('button', { id: 'reset', onClick: () => setValue(72.5) }, 'Reset'),
    React.createElement('button', { id: 'rerender', onMouseDown: e => e.preventDefault(), onClick: () => setOther(v => v + 1) }, 'Rerender'),
    React.createElement(Input, { id: 'plain', ref: fieldRef, type: 'number', required: true, min: 1, step: 'any', value: plain, onChange: e => setPlain(Number(e.target.value) || 0) }),
    React.createElement('output', { id: 'plain-value' }, String(plain)),
    React.createElement(Input, { id: 'clamped', type: 'number', value: clamped, onChange: e => setClamped(Math.max(10, Number(e.target.value) || 10)) }),
    React.createElement('output', { id: 'clamped-value' }, String(clamped)),
    React.createElement(EditableNumberInput, { id: 'raw', className: 'original-style', value: raw, onChange: e => setRaw(Number(e.target.value) || 0) }),
    React.createElement(Input, { id: 'uncontrolled', type: 'number', defaultValue: 7 }),
    React.createElement(Input, { id: 'text', value: text, onChange: e => setText(e.target.value) }),
    React.createElement('button', { id: 'plain-reset', onClick: () => setPlain(20) }, 'Reset plain'),
    React.createElement('button', { id: 'plain-zero', onClick: () => setPlain(0) }, 'Zero plain'),
    React.createElement('button', { id: 'focus-ref', onClick: () => fieldRef.current.focus() }, 'Focus')
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
  browser = await chromium.launch({ headless: true, executablePath: process.env.NUMERIC_TEST_BROWSER_PATH || undefined });
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

test("leaving an empty field keeps it blank and forwards blur", async () => {
  const field = page.locator("#cost");
  await field.fill("");
  assert.equal(await page.locator("#focused").textContent(), "true");
  await field.press("Tab");
  assert.equal(await field.inputValue(), "");
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

test("shared Input stays blank after a nonzero value is cleared, blurred, and rerendered", async () => {
  const field = page.locator('#plain');
  await field.fill('');
  assert.equal(await field.inputValue(), '');
  assert.equal(await page.locator('#plain-value').textContent(), '0');
  await field.press('Tab');
  await page.locator('#rerender').click();
  assert.equal(await field.inputValue(), '');
  await field.pressSequentially('125');
  assert.equal(await field.inputValue(), '125');
  assert.equal(await page.locator('#plain-value').textContent(), '125');
});

test("shared Input respects explicit zero and one Backspace deletes it", async () => {
  const field = page.locator('#plain');
  await field.fill('0');
  assert.equal(await field.inputValue(), '0');
  await field.press('End');
  await field.press('Backspace');
  assert.equal(await field.inputValue(), '');
  await field.pressSequentially('5');
  assert.equal(await field.inputValue(), '5');
});

test("clamped parent fallback cannot refill a cleared field", async () => {
  const field = page.locator('#clamped');
  await field.fill('');
  await field.press('Tab');
  assert.equal(await field.inputValue(), '');
  assert.equal(await page.locator('#clamped-value').textContent(), '10');
  await field.fill('30');
  assert.equal(await field.inputValue(), '30');
});

test("external changes replace a blank and an old zero cannot resurrect it", async () => {
  const field = page.locator('#plain');
  await field.fill('');
  await page.locator('#plain-reset').click();
  assert.equal(await field.inputValue(), '20');
  await page.locator('#plain-zero').click();
  assert.equal(await field.inputValue(), '0');
});

test("native primitive preserves styling, negative numbers, and decimals", async () => {
  const field = page.locator('#raw');
  assert.equal(await field.getAttribute('class'), 'original-style');
  await field.fill('');
  await field.pressSequentially('-12.5');
  assert.equal(await field.inputValue(), '-12.5');
  await field.fill('');
  await field.pressSequentially('0.25');
  assert.equal(await field.inputValue(), '0.25');
});

test("required blank remains invalid and min and step validation remain native", async () => {
  const field = page.locator('#plain');
  await field.fill('');
  assert.equal(await field.evaluate(el => el.validity.valueMissing), true);
  await field.fill('0');
  assert.equal(await field.evaluate(el => el.validity.rangeUnderflow), true);
  await field.fill('12.5');
  assert.equal(await field.evaluate(el => el.checkValidity()), true);
});

test("uncontrolled numeric and ordinary text inputs retain their normal behavior", async () => {
  const field = page.locator('#uncontrolled');
  assert.equal(await field.inputValue(), '7');
  await field.fill('');
  await field.press('Tab');
  assert.equal(await field.inputValue(), '');
  await field.fill('42');
  assert.equal(await field.inputValue(), '42');
  await page.locator('#text').fill('');
  await page.locator('#text').fill('world');
  assert.equal(await page.locator('#text').inputValue(), 'world');
});

test("forwarded ref still focuses the native input", async () => {
  await page.locator('#focus-ref').click();
  assert.equal(await page.locator('#plain').evaluate(el => el === document.activeElement), true);
});

test("minimum-one NumberInput also stays blank after blur", async () => {
  await page.locator('#quantity').fill('');
  await page.locator('#quantity').press('Tab');
  assert.equal(await page.locator('#quantity').inputValue(), '');
  assert.equal(await page.locator('#quantity-value').textContent(), '1');
});
