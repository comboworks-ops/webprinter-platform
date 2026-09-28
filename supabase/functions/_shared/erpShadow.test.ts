import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSyntheticErpShadowEvent,
  isAllowedErpGatewayUrl,
  parseErpShadowMode,
  retryDelaySeconds,
  signErpShadowBody,
  validateErpShadowEvent,
} from "./erpShadow.ts";

test("synthetic event is valid and posting remains disabled", () => {
  const event = buildSyntheticErpShadowEvent(4);
  assert.deepEqual(validateErpShadowEvent(event), []);
  assert.equal(event.payload.production.inventoryPosting, "disabled");
  assert.equal(event.payload.accounting.posting, "disabled");
  assert.equal(
    event.idempotencyKey,
    `webprinter:${event.source.tenantId}:production-order:` +
      `${event.source.orderId}:revision-4`,
  );
});

test("validation rejects an idempotency identity mismatch", () => {
  const event = buildSyntheticErpShadowEvent(7);
  const invalid = {
    ...event,
    idempotencyKey:
      "webprinter:synthetic:production-order:smoke-1:revision-7",
  };

  assert.equal(
    validateErpShadowEvent(invalid).includes(
      "idempotencyKey does not match the source identity",
    ),
    true,
  );
});

test("validation rejects personal data and live inventory effects", () => {
  const event = buildSyntheticErpShadowEvent();
  const invalid = {
    ...event,
    emailAddress: "person@example.test",
    payload: {
      ...event.payload,
      production: {
        ...event.payload.production,
        inventoryPosting: "enabled",
      },
    },
  };
  const errors = validateErpShadowEvent(invalid);
  assert.equal(errors.includes("personal or secret data is forbidden"), true);
  assert.equal(errors.includes("inventory posting must be disabled"), true);
});

test("runtime defaults to disabled and local HTTP is synthetic-only", () => {
  assert.equal(parseErpShadowMode(undefined), "disabled");
  assert.equal(parseErpShadowMode("live"), "disabled");
  assert.equal(
    isAllowedErpGatewayUrl(
      "http://host.docker.internal:8789/v1/events",
      "synthetic",
    ),
    true,
  );
  assert.equal(
    isAllowedErpGatewayUrl(
      "http://host.docker.internal:8789/v1/events",
      "shadow",
    ),
    false,
  );
  assert.equal(
    isAllowedErpGatewayUrl("https://erp.example.test/v1/events", "shadow"),
    true,
  );
});

test("HMAC matches the gateway conformance vector and retry delay is bounded", async () => {
  const signature = await signErpShadowBody(
    "{\"effect\":\"shadow_only\"}",
    "1785141000",
    "a".repeat(64),
  );
  assert.equal(
    signature,
    "d72f39df4e4b57547e419656a8633a29ddb3a6d28ab9bee2d472eac8c015113e",
  );
  assert.equal(retryDelaySeconds(1), 15);
  assert.equal(retryDelaySeconds(99), 3600);
});
