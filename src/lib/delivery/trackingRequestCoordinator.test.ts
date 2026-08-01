import assert from "node:assert/strict";
import test from "node:test";

import {
  TrackingRequestCoordinator,
  type TrackingRequestToken,
} from "./trackingRequestCoordinator.ts";

const ORDER_ID = "20000000-0000-4000-8000-000000000002";

test("a delayed initial load cannot replace the fresher same-order post-sync timeline", async () => {
  const coordinator = new TrackingRequestCoordinator();
  coordinator.open(ORDER_ID);

  const delayedInitial = coordinator.beginRequest(ORDER_ID);
  const syncView = coordinator.captureView(ORDER_ID);
  const freshPostSync = coordinator.beginRequest(ORDER_ID);
  const initialResult = deferred<string>();
  let rendered = "loading";
  const apply = async (
    token: TrackingRequestToken,
    result: Promise<string>,
  ) => {
    const value = await result;
    if (coordinator.isCurrentRequest(token)) rendered = value;
  };

  const delayedWork = apply(delayedInitial, initialResult.promise);
  await apply(freshPostSync, Promise.resolve("fresh"));
  assert.equal(coordinator.isCurrentView(syncView), true);
  initialResult.resolve("stale");
  await delayedWork;

  assert.equal(rendered, "fresh");
});

test("closing and reopening the same order invalidates prior timeline, sync, and toast work", () => {
  const coordinator = new TrackingRequestCoordinator();
  coordinator.open(ORDER_ID);
  const priorTimeline = coordinator.beginRequest(ORDER_ID);
  const priorSync = coordinator.captureView(ORDER_ID);

  coordinator.close();
  coordinator.open(ORDER_ID);
  const reopenedTimeline = coordinator.beginRequest(ORDER_ID);
  const reopenedView = coordinator.captureView(ORDER_ID);

  assert.equal(coordinator.isCurrentRequest(priorTimeline), false);
  assert.equal(coordinator.isCurrentView(priorSync), false);
  assert.equal(coordinator.isCurrentRequest(reopenedTimeline), true);
  assert.equal(coordinator.isCurrentView(reopenedView), true);
});

function deferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return Object.freeze({ promise, resolve });
}
