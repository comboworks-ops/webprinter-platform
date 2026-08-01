import assert from "node:assert/strict";
import test from "node:test";

import {
  TrackingRequestCoordinator,
  type TrackingRequestToken,
} from "./trackingRequestCoordinator.ts";

const ORDER_ID = "20000000-0000-4000-8000-000000000002";
const TRACKING_A = "0037 3500-4895 3047 0000";
const TRACKING_B = "NEW-TRACKING-IDENTITY";

test("a delayed initial load cannot replace the fresher same-order post-sync timeline", async () => {
  const coordinator = new TrackingRequestCoordinator();
  coordinator.open(ORDER_ID, TRACKING_A);

  const delayedInitial = coordinator.beginRequest(ORDER_ID, TRACKING_A);
  const syncView = coordinator.captureView(ORDER_ID, TRACKING_A);
  const freshPostSync = coordinator.beginRequest(ORDER_ID, TRACKING_A);
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
  coordinator.open(ORDER_ID, TRACKING_A);
  const priorTimeline = coordinator.beginRequest(ORDER_ID, TRACKING_A);
  const priorSync = coordinator.captureView(ORDER_ID, TRACKING_A);

  coordinator.close();
  coordinator.open(ORDER_ID, TRACKING_A);
  const reopenedTimeline = coordinator.beginRequest(ORDER_ID, TRACKING_A);
  const reopenedView = coordinator.captureView(ORDER_ID, TRACKING_A);

  assert.equal(coordinator.isCurrentRequest(priorTimeline), false);
  assert.equal(coordinator.isCurrentView(priorSync), false);
  assert.equal(coordinator.isCurrentRequest(reopenedTimeline), true);
  assert.equal(coordinator.isCurrentView(reopenedView), true);
});

test("reassigning the same order from tracking A to B invalidates every delayed A request", () => {
  const coordinator = new TrackingRequestCoordinator();
  coordinator.open(ORDER_ID, TRACKING_A);
  const delayedA = coordinator.beginRequest(ORDER_ID, TRACKING_A);
  const syncA = coordinator.captureView(ORDER_ID, TRACKING_A);

  coordinator.open(ORDER_ID, TRACKING_B);
  const currentB = coordinator.beginRequest(ORDER_ID, TRACKING_B);

  assert.equal(coordinator.isCurrentRequest(delayedA), false);
  assert.equal(coordinator.isCurrentView(syncA), false);
  assert.equal(coordinator.isCurrentRequest(currentB), true);
  assert.equal(currentB.trackingIdentity, "NEWTRACKINGIDENTITY");
  assert.throws(() => coordinator.beginRequest(ORDER_ID, TRACKING_A));
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
