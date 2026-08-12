import test from "node:test";
import assert from "node:assert/strict";
import { collectProvider, providerKey } from "../src/wallet.js";

test("provider announcements deduplicate without preferring MetaMask", () => {
  const first = { info: { uuid: "one", name: "Wallet A" }, provider: { request() {} } };
  const duplicate = { info: { uuid: "one", name: "Wallet B" }, provider: { request() {} } };
  const map = collectProvider(new Map(), first);
  collectProvider(map, duplicate);
  assert.equal(map.size, 1);
  assert.equal(map.get("one"), first);
  assert.equal(providerKey(first), "one");
});

test("the same provider object is not listed twice under legacy metadata", () => {
  const provider = { request() {} };
  const map = collectProvider(new Map(), { info: { uuid: "eip" }, provider });
  collectProvider(map, { info: { uuid: "legacy" }, provider });
  assert.equal(map.size, 1);
});
