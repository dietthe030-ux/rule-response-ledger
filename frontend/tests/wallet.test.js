import test from "node:test";
import assert from "node:assert/strict";
import {
  collectProvider,
  discoverProviders,
  providerKey,
  shortValue,
  STUDIO_CHAIN,
  walletUiState,
  watchProvider,
} from "../src/wallet.js";

test("wallet UI exposes disconnect only for an active app connection", () => {
  assert.equal(shortValue("0x1234567890"), "0x1234…7890");
  assert.deepEqual(walletUiState(null), {
    disconnectVisible: false,
    triggerLabel: "Connect wallet",
  });
  assert.deepEqual(walletUiState({ address: "0xbf9000000000000000000000000000000000b40d" }), {
    disconnectVisible: true,
    triggerLabel: "0xbf90…b40d",
  });
});

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

test("EIP-6963 metadata replaces the same wallet's legacy entry in either order", () => {
  const legacy = {
    info: { uuid: "legacy-0-metamask", name: "MetaMask", rdns: "io.metamask" },
    provider: { request() {} },
  };
  const announced = {
    info: { uuid: "announced-metamask", name: "MetaMask", rdns: "io.metamask" },
    provider: { request() {} },
  };
  const announcedFirst = collectProvider(collectProvider(new Map(), announced), legacy);
  const legacyFirst = collectProvider(collectProvider(new Map(), legacy), announced);
  assert.deepEqual([...announcedFirst.values()], [announced]);
  assert.deepEqual([...legacyFirst.values()], [announced]);
});

test("distinct EIP-6963 instances remain selectable even when rdns matches", () => {
  const first = { info: { uuid: "one", rdns: "io.wallet" }, provider: { request() {} } };
  const second = { info: { uuid: "two", rdns: "io.wallet" }, provider: { request() {} } };
  const map = collectProvider(collectProvider(new Map(), first), second);
  assert.equal(map.size, 2);
});

test("provider discovery never requests an account on page load", () => {
  const originalWindow = globalThis.window;
  let requests = 0;
  const listeners = new Map();
  globalThis.window = {
    ethereum: { request() { requests += 1; } },
    addEventListener(event, listener) { listeners.set(event, listener); },
    removeEventListener(event, listener) {
      if (listeners.get(event) === listener) listeners.delete(event);
    },
    dispatchEvent() {},
  };
  try {
    const snapshots = [];
    const stop = discoverProviders((providers) => snapshots.push(providers));
    assert.equal(requests, 0);
    assert.equal(snapshots.at(-1).length, 1);
    stop();
    assert.equal(listeners.size, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("Studionet metadata uses the current official explorer", () => {
  assert.deepEqual(STUDIO_CHAIN.blockExplorerUrls, ["https://explorer-studio.genlayer.com"]);
});

test("provider lifecycle reports account, chain, disconnect and supports cleanup", () => {
  const listeners = new Map();
  const provider = {
    on(event, listener) { listeners.set(event, listener); },
    removeListener(event, listener) {
      if (listeners.get(event) === listener) listeners.delete(event);
    },
  };
  const states = [];
  const stop = watchProvider(provider, (state) => states.push(state));
  listeners.get("accountsChanged")(["0xabc"]);
  listeners.get("accountsChanged")([]);
  listeners.get("chainChanged")("0x1");
  listeners.get("chainChanged")("0xf22f");
  listeners.get("disconnect")();
  assert.deepEqual(states.map(({ type }) => type), [
    "account", "disconnect", "wrong-chain", "studionet", "disconnect",
  ]);
  stop();
  assert.equal(listeners.size, 0);
});

test("switching providers removes the previous provider listeners", () => {
  const firstListeners = new Map();
  const first = {
    on(event, listener) { firstListeners.set(event, listener); },
    removeListener(event, listener) {
      if (firstListeners.get(event) === listener) firstListeners.delete(event);
    },
  };
  const secondListeners = new Map();
  const second = {
    on(event, listener) { secondListeners.set(event, listener); },
    removeListener(event, listener) {
      if (secondListeners.get(event) === listener) secondListeners.delete(event);
    },
  };
  const stopFirst = watchProvider(first, () => {});
  stopFirst();
  const stopSecond = watchProvider(second, () => {});
  assert.equal(firstListeners.size, 0);
  assert.equal(secondListeners.size, 3);
  stopSecond();
});
