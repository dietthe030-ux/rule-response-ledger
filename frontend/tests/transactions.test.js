import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFinalizedSuccess,
  clearPending,
  isRetryableRpcError,
  prepareWrite,
  readPending,
  storePending,
} from "../src/transactions.js";

test("write preparation snapshots enabled form fields before disabling controls", () => {
  const calls = [];
  const form = { disabled: false };
  const data = prepareWrite(
    form,
    (current) => {
      calls.push("snapshot");
      return { commentId: current.disabled ? null : "EPA-R03-OAR-2025-0174-0066" };
    },
    (current, busy) => {
      calls.push("disable");
      current.disabled = busy;
    },
  );
  assert.deepEqual(calls, ["snapshot", "disable"]);
  assert.equal(data.commentId, "EPA-R03-OAR-2025-0174-0066");
});

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("requires final consensus and successful leader execution", () => {
  const receipt = { statusName: "FINALIZED", consensus_data: { final: true }, txExecutionResultName: "FINISHED_WITH_RETURN" };
  assert.equal(assertFinalizedSuccess(receipt), receipt);
  const currentSdkReceipt = {
    status: 7,
    status_name: "FINALIZED",
    consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", result: { status: "return" } }] },
  };
  assert.equal(assertFinalizedSuccess(currentSdkReceipt), currentSdkReceipt);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, statusName: "ACCEPTED" }), /FINALIZED/);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, consensus_data: { final: false } }), /not marked final/);
  assert.throws(() => assertFinalizedSuccess({ ...receipt, txExecutionResultName: "FINISHED_WITH_ERROR" }), /did not finish/);
  assert.throws(() => assertFinalizedSuccess({ ...currentSdkReceipt, consensus_data: { leader_receipt: [{ execution_result: "ERROR", result: { status: "error" } }] } }), /did not finish/);
});

test("pending intent persists and clears", () => {
  const fake = storage();
  storePending({ method: "register_record", hash: null }, fake);
  assert.deepEqual(readPending(fake), { method: "register_record", hash: null });
  clearPending(fake);
  assert.equal(readPending(fake), null);
});

test("only transient RPC failures are retried", () => {
  assert.equal(isRetryableRpcError(new Error("Failed to fetch")), true);
  assert.equal(isRetryableRpcError({ message: "unknown", cause: new Error("Rate limit exceeded") }), true);
  assert.equal(isRetryableRpcError(new Error("Execution did not finish with a return")), false);
});
