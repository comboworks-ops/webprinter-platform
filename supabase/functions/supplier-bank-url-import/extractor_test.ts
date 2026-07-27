import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { extractSupplierProductHtml } from "./extractor.ts";

Deno.test("extracts product metadata and visible quantity prices", () => {
  const result = extractSupplierProductHtml(`
    <html>
      <head>
        <meta property="og:title" content="Foldere med 3 fløje" />
        <meta name="description" content="Trykte foldere" />
      </head>
      <body>
        <ul><li>100 stk. 19,95 EUR</li><li>250 stk. 29,50 €</li></ul>
      </body>
    </html>
  `);

  assertEquals(result.title, "Foldere med 3 fløje");
  assertEquals(result.description, "Trykte foldere");
  assertEquals(result.prices.map((row) => [row.quantity, row.supplierPrice]), [
    [100, 19.95],
    [250, 29.5],
  ]);
});

Deno.test("does not invent prices for a dynamic configurator", () => {
  const result = extractSupplierProductHtml("<html><body><h1>Visitkort</h1><div id='calculator'></div></body></html>");
  assertEquals(result.prices, []);
  assertStringIncludes(result.warnings.join(" "), "Dynamisk leverandørudtræk");
});

Deno.test("extracts JSON-LD offers only when quantity is explicit", () => {
  const result = extractSupplierProductHtml(`
    <script type="application/ld+json">
      {"@type":"Product","offers":[
        {"price":"12.50","priceCurrency":"EUR","eligibleQuantity":{"value":100}},
        {"price":"9.99","priceCurrency":"EUR"}
      ]}
    </script>
  `);

  assertEquals(result.prices.length, 1);
  assertEquals(result.prices[0].quantity, 100);
  assertEquals(result.prices[0].supplierPrice, 12.5);
});
