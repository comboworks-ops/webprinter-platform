import test from "node:test";
import assert from "node:assert/strict";

import { runExtractorChain } from "../extractors.js";

function provider(name, calls, outcome) {
  return {
    name,
    errorKey: `${name}Error`,
    async extract() {
      calls.push(name);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
}

test("extractor chain stops after the primary Playwright provider succeeds", async () => {
  const calls = [];
  const result = await runExtractorChain({
    url: "https://example.com",
    ulSelector: "ul.prices",
    providers: [
      provider("playwright", calls, { provider: "playwright", liTexts: ["100 - 10 EUR"] }),
      provider("staticHtml", calls, { provider: "static-html", liTexts: ["unused"] }),
      provider("firecrawl", calls, { provider: "firecrawl", liTexts: ["unused"] }),
    ],
  });

  assert.deepEqual(calls, ["playwright"]);
  assert.equal(result.provider, "playwright");
  assert.equal(result.firecrawlError, undefined);
});

test("extractor chain uses Scrapling before static HTML and metered Firecrawl", async () => {
  const calls = [];
  const result = await runExtractorChain({
    url: "https://example.com",
    ulSelector: "ul.prices",
    providers: [
      provider("playwright", calls, new Error("browser failed")),
      provider("scrapling", calls, {
        provider: "scrapling-http",
        liTexts: ["100 - 10 EUR"],
      }),
      provider("staticHtml", calls, { provider: "static-html", liTexts: ["100 - 10 EUR"] }),
      provider("firecrawl", calls, { provider: "firecrawl", liTexts: ["unused"] }),
    ],
  });

  assert.deepEqual(calls, ["playwright", "scrapling"]);
  assert.equal(result.provider, "scrapling-http");
  assert.equal(result.playwrightError, "browser failed");
});

test("extractor chain uses static HTML when Playwright and Scrapling fail", async () => {
  const calls = [];
  const result = await runExtractorChain({
    url: "https://example.com",
    ulSelector: "ul.prices",
    providers: [
      provider("playwright", calls, new Error("browser failed")),
      provider("scrapling", calls, new Error("scrapling failed")),
      provider("staticHtml", calls, { provider: "static-html", liTexts: ["100 - 10 EUR"] }),
      provider("firecrawl", calls, { provider: "firecrawl", liTexts: ["100 - 10 EUR"] }),
    ],
  });

  assert.deepEqual(calls, ["playwright", "scrapling", "staticHtml"]);
  assert.equal(result.provider, "static-html");
  assert.equal(result.playwrightError, "browser failed");
  assert.equal(result.scraplingError, "scrapling failed");
});

test("extractor chain reaches Firecrawl only after every local path fails", async () => {
  const calls = [];
  const result = await runExtractorChain({
    url: "https://example.com",
    ulSelector: "ul.prices",
    providers: [
      provider("playwright", calls, new Error("browser failed")),
      provider("scrapling", calls, new Error("scrapling failed")),
      provider("staticHtml", calls, new Error("static failed")),
      provider("firecrawl", calls, { provider: "firecrawl", liTexts: ["100 - 10 EUR"] }),
    ],
  });

  assert.deepEqual(calls, ["playwright", "scrapling", "staticHtml", "firecrawl"]);
  assert.equal(result.provider, "firecrawl");
  assert.equal(result.scraplingError, "scrapling failed");
  assert.equal(result.staticHtmlError, "static failed");
});

test("extractor chain reports every provider failure", async () => {
  const calls = [];
  await assert.rejects(
    runExtractorChain({
      url: "https://example.com",
      ulSelector: "ul.prices",
      providers: [
        provider("playwright", calls, new Error("browser failed")),
        provider("scrapling", calls, new Error("scrapling failed")),
        provider("staticHtml", calls, new Error("static failed")),
        provider("firecrawl", calls, new Error("metered fallback failed")),
      ],
    }),
    /playwright: browser failed; scrapling: scrapling failed; staticHtml: static failed; firecrawl: metered fallback failed/
  );
  assert.deepEqual(calls, ["playwright", "scrapling", "staticHtml", "firecrawl"]);
});
