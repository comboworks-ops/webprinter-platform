import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../..");

const readLaunchCall = (relativePath) => {
  const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
  const callStart = source.indexOf("resolveSelectedDesignerTemplateLaunch({");
  assert.notEqual(callStart, -1, `${relativePath} must resolve the selected Designer template`);
  const openingParen = source.indexOf("(", callStart);
  let depth = 0;
  let callEnd = -1;
  for (let index = openingParen; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        callEnd = index;
        break;
      }
    }
  }
  assert.notEqual(callEnd, -1, `${relativePath} Designer resolver call must be complete`);
  return {
    source,
    callStart,
    callEnd,
    call: source.slice(callStart, callEnd + 1),
  };
};

test("both product-page renderers pass exact Matrix section selections into template matching", () => {
  for (const relativePath of [
    "src/pages/ProductPrice.tsx",
    "src/components/content/ProductPriceContent.tsx",
  ]) {
    const { call } = readLaunchCall(relativePath);
    assert.match(
      call,
      /selectedSectionValues\s*:\s*matrixSelectedSectionValues/,
      `${relativePath} must pass five-axis Matrix selections to fail-closed template matching`,
    );
  }
});

test("both product-page renderers recompute the template launch when Matrix selections change", () => {
  for (const relativePath of [
    "src/pages/ProductPrice.tsx",
    "src/components/content/ProductPriceContent.tsx",
  ]) {
    const { source, callEnd } = readLaunchCall(relativePath);
    const dependencyStart = source.indexOf("[", callEnd);
    const dependencyEnd = dependencyStart === -1 ? -1 : source.indexOf("]", dependencyStart);
    assert.notEqual(dependencyStart, -1, `${relativePath} must memoize the Designer launch`);
    assert.notEqual(dependencyEnd, -1, `${relativePath} Designer launch dependencies must be complete`);
    assert.ok(dependencyStart - callEnd < 80, `${relativePath} dependencies must directly follow the resolver call`);
    const dependencies = source.slice(dependencyStart, dependencyEnd + 1);
    assert.match(
      dependencies,
      /matrixSelectedSectionValues/,
      `${relativePath} must recompute after a Matrix selection changes`,
    );
  }
});
