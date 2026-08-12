import test from "node:test";
import assert from "node:assert/strict";
import { assertFinalizedSuccess, clearPending, readPending, storePending } from "../src/transactions.js";

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("requires final consensus and successful leader execution", () => {
  const receipt = { statusName: "FINALIZED", consensus_data: { final: true }, txExecutionResultName: "FINISHED_WITH_RETURN" };
  assert.equal(assertFinalizedSuccess(receipt), receipt);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, statusName: "ACCEPTED" }), /FINALIZED/);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, consensus_data: { final: false } }), /not marked final/);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, txExecutionResultName: "FINISHED_WITH_ERROR" }), /did not finish/);
});

test("pending intent persists and clears", () => {
  const fake = storage();
  storePending({ method: "register_record", hash: null }, fake);
  assert.deepEqual(readPending(fake), { method: "register_record", hash: null });
  clearPending(fake);
  assert.equal(readPending(fake), null);
});
