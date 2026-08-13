import { ExecutionResult, TransactionStatus, transactionsStatusNumberToName } from "genlayer-js/types";

export const PENDING_KEY = "rrl.pending.v1";

export function prepareWrite(form, snapshot, setBusy) {
  const data = snapshot(form);
  setBusy(form, true);
  return data;
}

export function assertFinalizedSuccess(receipt) {
  const status = receipt?.statusName
    || receipt?.status_name
    || transactionsStatusNumberToName[receipt?.status];
  if (status !== TransactionStatus.FINALIZED) {
    throw new Error(`Expected FINALIZED; received ${status || "UNKNOWN"}.`);
  }
  if ("final" in (receipt?.consensus_data || {}) && receipt.consensus_data.final !== true) {
    throw new Error("Receipt is not marked final by consensus.");
  }
  const leader = receipt?.consensus_data?.leader_receipt?.[0];
  const execution = receipt?.txExecutionResultName || leader?.result?.status;
  const succeeded = execution === ExecutionResult.FINISHED_WITH_RETURN
    || (leader?.execution_result === "SUCCESS" && execution === "return");
  if (!succeeded) {
    throw new Error(`Execution did not finish with a return: ${execution || "UNKNOWN"}.`);
  }
  return receipt;
}

export function readPending(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

export function storePending(value, storage = localStorage) {
  storage.setItem(PENDING_KEY, JSON.stringify(value));
}

export function clearPending(storage = localStorage) {
  storage.removeItem(PENDING_KEY);
}

export function isRetryableRpcError(error) {
  const text = [error?.message, error?.shortMessage, error?.details, error?.cause?.message]
    .filter(Boolean).join(" ");
  return /failed to fetch|rate limit|rpc error|network|timed? out|timeout/i.test(text);
}

export async function submitFinalized({ client, call, intent, readback, onPending }) {
  const pending = { ...intent, startedAt: new Date().toISOString(), hash: null };
  storePending(pending);
  onPending?.(pending);
  const hash = await client.writeContract(call);
  const submitted = { ...pending, hash };
  storePending(submitted);
  onPending?.(submitted);
  const receipt = assertFinalizedSuccess(await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 6_000,
    retries: 60,
  }));
  const state = await readback(receipt);
  clearPending();
  return { hash, receipt, state };
}
