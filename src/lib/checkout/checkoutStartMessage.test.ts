import assert from "node:assert/strict";
import test from "node:test";
import { checkoutStartMessage } from "./checkoutStartMessage.ts";

test("a missing trusted price explains the blocker without exposing backend errors", async () => {
  const error = {context: Response.json({contract_version: 2, error: "checkout_storformat_price_missing"}, {status: 409})};
  assert.match(await checkoutStartMessage(error), /mangler en entydig pris/);
  assert.equal(error.context.bodyUsed, false);
  const unknown = {context: Response.json({contract_version: 2, error: "private_database_detail"})};
  assert.doesNotMatch(await checkoutStartMessage(unknown), /private_database_detail/);
});

test("invalid responses keep retry guidance and never claim no payment exists", async () => {
  for (const error of [{context: new Response("offline", {status: 503})}, new Error("sensitive detail"), null]) {
    assert.match(await checkoutStartMessage(error), /samme oplysninger/);
  }
});
