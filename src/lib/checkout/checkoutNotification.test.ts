import assert from "node:assert/strict";
import test from "node:test";
import { checkoutNotificationNotice } from "./checkoutNotification.ts";

test("a queued confirmation never claims the email has been sent", () => {
  for (const status of ["pending", "processing"]) {
    const notice = checkoutNotificationNotice({status});
    assert.equal(notice.warning, false);
    assert.match(notice.message, /sat i kø/);
    assert.doesNotMatch(notice.message, /er afsendt/);
  }
});

test("only provider acceptance permits a sent confirmation message", () => {
  assert.match(checkoutNotificationNotice({status: "accepted"}).message, /er afsendt/);
  for (const notification of [null, {}, {status: "sent"}, {status: "failed"}, {status: "needs_review"}]) {
    const notice = checkoutNotificationNotice(notification);
    assert.equal(notice.warning, true);
    assert.doesNotMatch(notice.message, /er afsendt/);
  }
});
