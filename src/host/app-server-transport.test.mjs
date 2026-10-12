import assert from "node:assert/strict";
import test from "node:test";
import { CodexAppServerTransport } from "./app-server-transport.mjs";

const settle = () => new Promise((resolve) => setImmediate(resolve));

// `scheduleWhenIdle` is only correct if *every* transition that clears the last
// busy signal wakes its waiters. The approval-answer and request-timeout paths
// cleared those sets without notifying, which stranded a deferred Codex
// configuration reload until the next app-server restart: the credential was
// durable in config.toml but never reached the live app-server.
test("a deferred reload wakes when the last approval is answered", async () => {
  const transport = new CodexAppServerTransport();
  transport.pendingServerRequests.set(7, { id: 7, method: "item/commandExecution/requestApproval" });

  let reloaded = false;
  const scheduled = transport.scheduleWhenIdle(() => { reloaded = true; });
  scheduled.catch(() => {});

  // No stdin here, so the response write is expected to fail. The wake must not
  // depend on that write succeeding: the approval no longer holds the transport
  // busy either way.
  assert.throws(() => transport.respondToServerRequest(7, { decision: "accept" }));
  assert.equal(transport.isBusy(), false, "answering the last approval clears the busy signal");

  await settle();
  await scheduled;
  assert.equal(reloaded, true, "the deferred reload runs once the transport is idle");
});

test("a deferred reload wakes when the last in-flight request times out", async () => {
  const transport = new CodexAppServerTransport();
  transport.process = { stdin: { writable: true, write() {} } };

  const timedOut = transport.request("thread/list", {}, 25, { skipStart: true }).catch(() => {});
  let reloaded = false;
  const scheduled = transport.scheduleWhenIdle(() => { reloaded = true; });
  scheduled.catch(() => {});

  await timedOut;
  assert.equal(transport.isBusy(), false, "the timed-out request clears the busy signal");

  await settle();
  await scheduled;
  assert.equal(reloaded, true, "the deferred reload runs once the transport is idle");
});
