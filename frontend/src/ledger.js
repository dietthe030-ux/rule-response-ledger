import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { submitFinalized } from "./transactions.js";

export const DOCKET_ID = "EPA-R03-OAR-2025-0174";
export const FINAL_NUMBER = "2025-12527";
export const FINAL_URL = "https://public-inspection.federalregister.gov/2025-12527.pdf";
export const RESPONSE_ID = `${DOCKET_ID}-0076`;
export const RESPONSE_URL = `https://downloads.regulations.gov/${RESPONSE_ID}/content.pdf`;
export const EXPLORER = "https://explorer-studio.genlayer.com";

export function validContractAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}

export function canonicalCommentUrl(commentId) {
  if (!new RegExp(`^${DOCKET_ID}-[0-9]{4}$`).test(commentId || "")) return "";
  return `https://downloads.regulations.gov/${commentId}/attachment_1.pdf`;
}

export function parseStoredJson(value) {
  if (typeof value !== "string") throw new Error("Contract returned an unexpected value.");
  return JSON.parse(value);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
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

export async function readRevision(address, recordId, index, client = publicClient) {
  return parseStoredJson(await client.readContract({
    address,
    functionName: "get_revision",
    args: [recordId, index],
  }));
}

export async function readRevisions(address, record, client = publicClient) {
  return Promise.all(Array.from(
    { length: Number(record.revision_count) },
    (_, index) => readRevision(address, record.record_id, index, client),
  ));
}

export async function readRecords(address, client = publicClient) {
  const count = Number(await client.readContract({ address, functionName: "get_record_count", args: [] }));
  const ids = await Promise.all(Array.from({ length: count }, (_, index) => client.readContract({
    address,
    functionName: "get_record_id",
    args: [index],
  })));
  return Promise.all(ids.map(async (id) => {
    const record = await readRecord(address, id, client);
    return { ...record, revisions: await readRevisions(address, record, client) };
  }));
}

export function recordMarkup(record) {
  const revisions = (record.revisions || []).map((revision) => `
    <section class="revision" aria-labelledby="${escapeHtml(revision.revision_id)}-title">
      <h4 id="${escapeHtml(revision.revision_id)}-title">${escapeHtml(revision.revision_id)}</h4>
      <dl class="revision-facts">
        <div><dt>Verdict</dt><dd>${escapeHtml(revision.verdict)}</dd></div>
        <div><dt>Rationale</dt><dd>${escapeHtml(revision.explanation)}</dd></div>
        <div><dt>Response source</dt><dd>${escapeHtml(revision.response_source)}</dd></div>
        <div><dt>Evidence digest</dt><dd class="revision-digest">${escapeHtml(revision.evidence_digest || "Not recorded")}</dd></div>
      </dl>
    </section>`).join("");

  return `
    <article class="record">
      <div class="record-id">${escapeHtml(record.record_id)}</div>
      <div class="record-body">
        <h3>${escapeHtml(record.issue_summary)}</h3>
        <p class="record-meta">${escapeHtml(record.comment_id)} · ${escapeHtml(record.revision_count)} revision(s) · follow-up ${escapeHtml(record.follow_up_status)}</p>
        <div class="record-revisions">${revisions || "<p class='record-meta'>No assessment revision yet.</p>"}</div>
      </div>
      <div class="record-status">${escapeHtml(record.status)}${record.current_revision_id ? `<br>${escapeHtml(record.current_revision_id)}` : ""}</div>
    </article>`;
}

export async function registerRecord(address, wallet, commentId, issueSummary, onPending) {
  const client = walletClient(wallet);
  const commentUrl = canonicalCommentUrl(commentId);
  return submitFinalized({
    client,
    intent: { method: "register_record", commentId, issueSummary },
    onPending,
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

export async function bindEvidence(address, wallet, recordId, onPending) {
  const client = walletClient(wallet);
  return submitFinalized({
    client,
    intent: { method: "bind_final_evidence", recordId },
    onPending,
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

export async function assessRecord(address, wallet, recordId, onPending) {
  const client = walletClient(wallet);
  const before = await readRecord(address, recordId, client);
  return submitFinalized({
    client,
    intent: { method: "assess_response", recordId, previousRevisionCount: before.revision_count },
    onPending,
    call: { address, functionName: "assess_response", args: [recordId], value: 0n },
    readback: async () => {
      const record = await readRecord(address, recordId, client);
      if (record.revision_count !== before.revision_count + 1) {
        throw new Error("Authoritative readback did not append exactly one revision.");
      }
      const revision = await readRevision(address, recordId, before.revision_count, client);
      return { record, revision };
    },
  });
}
