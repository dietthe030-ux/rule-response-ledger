import "./styles.css";
import {
  DOCKET_ID,
  EXPLORER,
  FINAL_NUMBER,
  FINAL_URL,
  RESPONSE_ID,
  RESPONSE_URL,
  assessRecord,
  bindEvidence,
  canonicalCommentUrl,
  publicClient,
  readRecord,
  readRecords,
  registerRecord,
  validContractAddress,
} from "./ledger.js";
import {
  connectSelectedProvider,
  discoverProviders,
  shortValue as short,
  walletUiState,
  watchProvider,
} from "./wallet.js";
import { assertFinalizedSuccess, clearPending, isRetryableRpcError, prepareWrite, readPending } from "./transactions.js";
import { TransactionStatus } from "genlayer-js/types";

const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS || "").trim();
const deployed = validContractAddress(contractAddress);
let wallet = null;
let stopWatchingWallet = () => {};
let providers = [];
let records = [];
let reconciliation = null;

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="shell">
    <aside class="rail" aria-label="Project navigation">
      <div>
        <p class="mark">Rule Response<br />Ledger</p>
        <div class="folio">Public record / 01</div>
      </div>
      <nav>
        <a href="#brief">Brief</a>
        <a href="#workbench">Workbench</a>
        <a href="#ledger">Ledger</a>
        <a href="#protocol">Protocol</a>
      </nav>
      <div class="rail-foot">
        <div>
          <div class="network-line"><span class="network-dot"></span> Studionet · 61999</div>
          <div class="folio" id="deployment-state">${deployed ? short(contractAddress) : "Awaiting deployment"}</div>
        </div>
        <button id="wallet-button" type="button">Connect wallet</button>
      </div>
    </aside>

    <main>
      <section class="section hero" id="brief">
        <div>
          <p class="eyebrow">Response accountability for public rules</p>
          <h1>Was the issue answered?</h1>
          <p class="dek">A fixed-scope evidence ledger for tracing whether a material public-comment issue received a substantive response in the final agency record.</p>
        </div>
        <aside class="scope-note" aria-label="MVP scope">
          <p class="section-number">Scope / fixed</p>
          <dl>
            <div><dt>Docket</dt><dd>${DOCKET_ID}</dd></div>
            <div><dt>Network</dt><dd>GenLayer Studionet</dd></div>
            <div><dt>Signal</dt><dd>Semantic, not legal</dd></div>
            <div><dt>Consensus</dt><dd>Independent evidence comparison</dd></div>
          </dl>
        </aside>
      </section>

      <section class="section" id="workbench">
        <header class="section-head">
          <span class="section-number">01 / Workbench</span>
          <div><h2>Build the evidence chain.</h2><p>Each write is confirmed only after final consensus, successful execution, and authoritative state readback.</p></div>
        </header>
        <div id="pending-slot"></div>
        <div class="workflow">
          <article class="step">
            <div><h3>Register an issue</h3><p>Name the material issue in one canonical comment attachment. This creates the durable fingerprint.</p></div>
              <form id="register-form">
                <label>Comment ID
                  <input id="comment-id" name="commentId" placeholder="${DOCKET_ID}-0066" pattern="${DOCKET_ID}-[0-9]{4}" required />
                  <span class="field-note" id="comment-url">Enter a valid comment ID to derive its canonical attachment URL.</span>
                </label>
                <label>Material issue
                  <textarea name="issueSummary" minlength="20" maxlength="360" placeholder="Describe one material issue raised in the selected comment." required></textarea>
                <span class="field-note">20–360 characters. The normalized text becomes part of the duplicate fingerprint.</span>
              </label>
              <div class="form-actions"><button data-write type="submit">Register record</button></div>
            </form>
          </article>

          <article class="step">
            <div><h3>Bind final evidence</h3><p>Attach the immutable final-rule and response-to-comments sources defined for this MVP.</p></div>
            <form id="bind-form">
              <label>Record ID<input name="recordId" placeholder="RRL-000001" pattern="RRL-[0-9]{6}" required /></label>
              <div class="field-note">Final ${FINAL_NUMBER} · Response ${RESPONSE_ID}</div>
              <div class="form-actions"><button data-write type="submit">Bind canonical sources</button></div>
            </form>
          </article>

          <article class="step">
            <div><h3>Assess the response</h3><p>Validators retrieve all three official sources and compare one constrained consequence-bearing verdict.</p></div>
            <form id="assess-form">
              <label>Record ID<input name="recordId" placeholder="RRL-000001" pattern="RRL-[0-9]{6}" required /></label>
              <div class="field-note">UNRESOLVED may be retried after one hour, up to three attempts.</div>
              <div class="form-actions"><button data-write type="submit">Run consensus assessment</button></div>
            </form>
          </article>
        </div>
        <p class="notice" id="notice" role="status" aria-live="polite"></p>
      </section>

      <section class="section" id="ledger">
        <header class="section-head">
          <span class="section-number">02 / Ledger</span>
          <div><h2>Read the public state.</h2><p>No wallet is required. Revisions remain addressable after the current record changes.</p></div>
        </header>
        <div class="ledger-tools"><span id="record-count">0 records</span><button class="secondary" id="refresh-button" type="button">Refresh state</button></div>
        <div class="records" id="records"></div>
      </section>

      <section class="section" id="protocol">
        <header class="section-head"><span class="section-number">03 / Protocol</span><div><h2>What consensus changes.</h2></div></header>
        <div class="protocol-grid">
          <article><h3>Evidence boundary</h3><p>Only the registered comment, the canonical final rule, and the canonical response document enter the assessment.</p></article>
          <article><h3>Consequence map</h3><ul><li>Addressed → no follow-up</li><li>Partial / not addressed → follow-up required</li><li>Unresolved → unknown</li></ul></article>
          <article><h3>Failure posture</h3><p>Unavailable or contradictory evidence resolves to UNRESOLVED. It is never silently converted into a negative finding.</p></article>
        </div>
      </section>

      <footer class="section colophon">
        <div class="colophon-grid">
          <div><p class="eyebrow">Source colophon</p><h2>Inspect the record.</h2></div>
          <ul class="source-list">
            <li><a href="https://www.regulations.gov/docket/${DOCKET_ID}" target="_blank" rel="noreferrer">Regulations.gov docket ${DOCKET_ID}</a></li>
            <li><a href="${FINAL_URL}" target="_blank" rel="noreferrer">Federal Register final document ${FINAL_NUMBER}</a></li>
            <li><a href="${RESPONSE_URL}" target="_blank" rel="noreferrer">Response-to-comments document ${RESPONSE_ID}</a></li>
            <li><a href="${EXPLORER}" target="_blank" rel="noreferrer">GenLayer Explorer</a></li>
          </ul>
        </div>
      </footer>
    </main>
  </div>

  <dialog id="provider-dialog" aria-labelledby="provider-title">
    <p class="section-number">Wallet providers</p>
    <h2 id="provider-title">Choose a provider.</h2>
    <p>The site will request an account only from the provider you select.</p>
    <div class="provider-list" id="provider-list"></div>
    <div class="dialog-actions">
      <button class="secondary" id="wallet-disconnect" type="button" hidden>Disconnect</button>
      <button class="secondary" id="provider-close" type="button">Cancel</button>
    </div>
  </dialog>
`;

const notice = document.querySelector("#notice");
const providerDialog = document.querySelector("#provider-dialog");
const walletButton = document.querySelector("#wallet-button");
const walletDisconnect = document.querySelector("#wallet-disconnect");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}
function setNotice(message, error = false) {
  notice.textContent = message;
  notice.style.color = error ? "var(--signal)" : "var(--federal-dark)";
}
function requireWriteReady() {
  if (!deployed) throw new Error("The contract has not been deployed yet.");
  if (!wallet) throw new Error("Choose and connect a wallet provider first.");
}
function syncWalletUi() {
  const state = walletUiState(wallet);
  walletButton.textContent = state.triggerLabel;
  walletDisconnect.hidden = !state.disconnectVisible;
}
function clearWallet(message, error = true) {
  stopWatchingWallet();
  stopWatchingWallet = () => {};
  wallet = null;
  syncWalletUi();
  setNotice(message, error);
  renderPending();
}
function followWallet(nextWallet) {
  stopWatchingWallet();
  wallet = nextWallet;
  syncWalletUi();
  stopWatchingWallet = watchProvider(wallet.provider, (state) => {
    if (state.type === "account") {
      wallet = { ...wallet, address: state.address };
      syncWalletUi();
      setNotice("Wallet account changed. Current identity updated.");
    } else if (state.type === "studionet") {
      clearWallet("Wallet returned to Studionet. Reconnect to authorize writes.");
    } else if (state.type === "wrong-chain") {
      clearWallet("Wallet left Studionet. Switch back and reconnect before writing.");
    } else {
      clearWallet("Wallet disconnected. Reconnect before writing.");
    }
  });
}
function setBusy(form, busy) {
  form.querySelectorAll("button, input, textarea").forEach((element) => { element.disabled = busy; });
}

function renderProviders() {
  const list = document.querySelector("#provider-list");
  if (!providers.length) {
    list.innerHTML = "<p>No supported EIP-1193 provider was announced. Install or enable a compatible browser wallet.</p>";
    return;
  }
  list.innerHTML = "";
  providers.forEach((detail, index) => {
    const button = document.createElement("button");
    button.className = "provider";
    button.type = "button";
    button.innerHTML = `<span><strong>${escapeHtml(detail.info?.name || `Provider ${index + 1}`)}</strong><br><small>${escapeHtml(detail.info?.rdns || "Injected provider")}</small></span>`;
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        followWallet(await connectSelectedProvider(detail));
        providerDialog.close();
        setNotice(`Connected ${detail.info?.name || "wallet"} on Studionet.`);
        renderPending();
      } catch (error) {
        setNotice(error.message || "Wallet connection failed.", true);
      } finally {
        button.disabled = false;
      }
    });
    list.append(button);
  });
}

discoverProviders((next) => { providers = next; renderProviders(); });
syncWalletUi();
walletButton.addEventListener("click", () => providerDialog.showModal());
walletDisconnect.addEventListener("click", () => {
  clearWallet("Wallet disconnected from this app.", false);
  providerDialog.close();
});
document.querySelector("#provider-close").addEventListener("click", () => providerDialog.close());

document.querySelector("#comment-id").addEventListener("input", (event) => {
  document.querySelector("#comment-url").textContent = canonicalCommentUrl(event.target.value.trim())
    || "Enter a valid comment ID to derive its canonical attachment URL.";
});

function renderPending() {
  const slot = document.querySelector("#pending-slot");
  const pending = readPending();
  if (!pending) { slot.innerHTML = ""; return; }
  slot.innerHTML = `<aside class="pending" role="status"><div class="pending-title"><span class="spinner" aria-hidden="true"></span><strong>Pending intent: ${escapeHtml(pending.method)}</strong></div><code>${escapeHtml(pending.hash || "No transaction hash recorded")}</code><div class="form-actions"><button id="reconcile-button" type="button" ${!pending.hash || !deployed ? "disabled" : ""}>Reconcile finalized state</button><button class="secondary" id="dismiss-pending" type="button">Dismiss local intent</button></div></aside>`;
  document.querySelector("#dismiss-pending").addEventListener("click", () => { clearPending(); renderPending(); });
  document.querySelector("#reconcile-button")?.addEventListener("click", () => startReconciliation(pending));
  startReconciliation(pending);
}

function startReconciliation(pending) {
  if (reconciliation || !pending?.hash || !deployed) return;
  reconciliation = reconcilePending(pending).finally(() => { reconciliation = null; });
}

async function reconcilePending(pending) {
  while (readPending()?.hash === pending.hash) {
    try {
      setNotice("Checking the recorded transaction and authoritative state…");
      const receipt = assertFinalizedSuccess(await publicClient.waitForTransactionReceipt({
        hash: pending.hash,
        status: TransactionStatus.FINALIZED,
        interval: 6_000,
        retries: 60,
      }));
      if (pending.recordId) await readRecord(contractAddress, pending.recordId);
      if (pending.commentId) {
        const recordId = await publicClient.readContract({
          address: contractAddress,
          functionName: "get_record_by_fingerprint",
          args: [pending.commentId, pending.issueSummary],
        });
        await readRecord(contractAddress, recordId);
      }
      clearPending();
      renderPending();
      await refreshRecords();
      setNotice(`Reconciled finalized transaction ${short(receipt.hash || pending.hash)}.`);
      return;
    } catch (error) {
      if (!isRetryableRpcError(error)) {
        setNotice(error.message || "Reconciliation failed.", true);
        return;
      }
      setNotice("Studionet RPC is temporarily unavailable. Retrying automatically in 15 seconds…", true);
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }
}

async function handleWrite(form, action, successMessage) {
  try {
    requireWriteReady();
    const data = prepareWrite(form, (current) => new FormData(current), setBusy);
    setNotice("Transaction submitted. Waiting for FINALIZED consensus…");
    const result = await action(data);
    renderPending();
    await refreshRecords();
    setNotice(`${successMessage} Transaction ${short(result.hash)}.`);
  } catch (error) {
    renderPending();
    setNotice(error.message || "Transaction failed.", true);
  } finally { setBusy(form, false); }
}

document.querySelector("#register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  handleWrite(event.currentTarget, (data) => registerRecord(
    contractAddress, wallet, data.get("commentId").trim(), data.get("issueSummary").trim(),
  ), "Record registered and read back");
});
document.querySelector("#bind-form").addEventListener("submit", (event) => {
  event.preventDefault();
  handleWrite(event.currentTarget, (data) => bindEvidence(contractAddress, wallet, data.get("recordId").trim()), "Canonical evidence bound and read back");
});
document.querySelector("#assess-form").addEventListener("submit", (event) => {
  event.preventDefault();
  handleWrite(event.currentTarget, (data) => assessRecord(contractAddress, wallet, data.get("recordId").trim()), "Assessment revision finalized and read back");
});

function renderRecords() {
  document.querySelector("#record-count").textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
  const container = document.querySelector("#records");
  if (!deployed) {
    container.innerHTML = "<p class='empty'>The Studionet deployment address will be configured after PRE_DEPLOY approval.</p>";
    return;
  }
  if (!records.length) { container.innerHTML = "<p class='empty'>No records have been registered.</p>"; return; }
  container.innerHTML = records.map((record) => `
    <article class="record">
      <div class="record-id">${escapeHtml(record.record_id)}</div>
      <div><h3>${escapeHtml(record.issue_summary)}</h3><p class="record-meta">${escapeHtml(record.comment_id)} · ${escapeHtml(record.revision_count)} revision(s) · follow-up ${escapeHtml(record.follow_up_status)}</p></div>
      <div class="record-status">${escapeHtml(record.status)}${record.current_revision_id ? `<br>${escapeHtml(record.current_revision_id)}` : ""}</div>
    </article>`).join("");
}

async function refreshRecords() {
  if (!deployed) { records = []; renderRecords(); return true; }
  try {
    records = await readRecords(contractAddress);
    renderRecords();
    return true;
  } catch (error) {
    records = [];
    renderRecords();
    setNotice(`Public read failed: ${error.message || error}`, true);
    return false;
  }
}

document.querySelector("#refresh-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    if (await refreshRecords()) setNotice("Public state refreshed.");
  } finally {
    button.textContent = "Refresh state";
    button.disabled = false;
  }
});
document.querySelectorAll("[data-write]").forEach((button) => { button.disabled = !deployed; });
renderPending();
refreshRecords();
