import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { submitFinalized } from "./transactions.js";

export const DOCKET_ID = "EPA-R03-OAR-2025-0174";
export const FINAL_NUMBER = "2025-12527";
export const FINAL_URL = "https://public-inspection.federalregister.gov/2025-12527.pdf";
export const RESPONSE_ID = `${DOCKET_ID}-0076`;
export const RESPONSE_URL = `https://downloads.regulations.gov/${RESPONSE_ID}/content.pdf`;
export const EXPLORER = studionet.blockExplorers.default.url;

export function validContractAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}

export function canonicalCommentUrl(commentId) {
  return `https://downloads.regulations.gov/${commentId}/attachment_1.pdf`;
}

export function parseStoredJson(value) {
  if (typeof value !== "string") throw new Error("Contract returned an unexpected value.");
  return JSON.parse(value);
}

export const publicClient = createClient({ chain: studionet });

export function walletClient(wallet) {
  return createClient({ chain: studionet, account: wallet.address, provider: wallet.provider });
}

export async function readRecord(address, recordId, client = publicClient) {
  return parseStoredJson(await client.readContract({
    address,
    functionName: "get_record",
    args: [recordId],
  }));
}

export async function readRecords(address, client = publicClient) {
  const count = Number(await client.readContract({ address, functionName: "get_record_count", args: [] }));
  const ids = await Promise.all(Array.from({ length: count }, (_, index) => client.readContract({
    address,
    functionName: "get_record_id",
    args: [index],
  })));
  return Promise.all(ids.map((id) => readRecord(address, id, client)));
}

export async function registerRecord(address, wallet, commentId, issueSummary) {
  const client = walletClient(wallet);
  const commentUrl = canonicalCommentUrl(commentId);
  return submitFinalized({
    client,
    intent: { method: "register_record", commentId, issueSummary },
    call: { address, functionName: "register_record", args: [commentId, commentUrl, issueSummary], value: 0n },
    readback: async () => {
      const recordId = await client.readContract({
        address,
        functionName: "get_record_by_fingerprint",
        args: [commentId, issueSummary],
      });
      return readRecord(address, recordId, client);
    },
  });
}

export async function bindEvidence(address, wallet, recordId) {
  const client = walletClient(wallet);
  return submitFinalized({
    client,
    intent: { method: "bind_final_evidence", recordId },
    call: {
      address,
      functionName: "bind_final_evidence",
      args: [recordId, FINAL_NUMBER, FINAL_URL, RESPONSE_ID, RESPONSE_URL],
      value: 0n,
    },
    readback: async () => {
      const record = await readRecord(address, recordId, client);
      if (record.status !== "READY") throw new Error("Authoritative readback did not reach READY.");
      return record;
    },
  });
}

export async function assessRecord(address, wallet, recordId) {
  const client = walletClient(wallet);
  const before = await readRecord(address, recordId, client);
  return submitFinalized({
    client,
    intent: { method: "assess_response", recordId, previousRevisionCount: before.revision_count },
    call: { address, functionName: "assess_response", args: [recordId], value: 0n },
    readback: async () => {
      const record = await readRecord(address, recordId, client);
      if (record.revision_count !== before.revision_count + 1) {
        throw new Error("Authoritative readback did not append exactly one revision.");
      }
      const revision = parseStoredJson(await client.readContract({
        address,
        functionName: "get_revision",
        args: [recordId, before.revision_count],
      }));
      return { record, revision };
    },
  });
}
