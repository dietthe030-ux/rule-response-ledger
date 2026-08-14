# Rule Response Ledger verification

This document consolidates reviewer-facing source, deployment, test, and live-path evidence. Internal checkpoint packages are intentionally excluded from the public repository.

## Exact source boundary

- Deployed frontend implementation commit: `5f77b0038bfceeb4d6c0036b9e287ff47fbdedd2`
- Contract source SHA-256: `EDEB1E2690FCA5F4CE6B82D4035CF1A29CB7C6587FF3423108BF523126D34571`
- Network: Studionet, chain ID `61999`
- Main contract: [`0x18E2134c1b2D93170Aa35599a891F3785bB91f0a`](https://explorer-studio.genlayer.com/address/0x18E2134c1b2D93170Aa35599a891F3785bB91f0a)
- Deployment transaction: [`0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1`](https://explorer-studio.genlayer.com/tx/0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1)
- Deployer/upgrader: `0x3851587431CfD3e46D1eAa77c0aDc2AD35087040`
- Live web URL: [`https://rule-response-ledger.vercel.app`](https://rule-response-ledger.vercel.app)
- Vercel project: `dietthe030-uxs-projects/rule-response-ledger`
- Current public release identity: stable alias `https://rule-response-ledger.vercel.app`
- Compiled main asset: `/assets/index-CZBn1epI.js`
- Compiled main asset SHA-256: `CE5CDA41551964EE103A3A66B0DF876824FE1B3EDD8B6AA9CCF0398A5691F98C`

The public release commit is the branch tip named in the pre-push and final immutable evidence packages. Embedding that commit's own hash inside itself would be self-referential; the deployed contract remains byte-bound to the implementation commit and source hash above.

The production deployment is `READY`. The public stable alias serves the compiled asset byte-for-byte equal to the verified local production build (399,876 bytes), contains the main contract address and explicit app-level disconnect flow, and excludes the isolated rehearsal address. Exact Vercel deployment IDs are retained in the external immutable review package instead of this source-controlled document, avoiding a deployment-ID self-reference loop. Vercel's deployment-specific URL may require authenticated team access; public smoke and asset-parity claims use only the stable alias. Registration fields start empty; placeholders are non-submittable guidance, and a canonical attachment URL appears only for a valid user-entered comment ID. Pending writes show an immediate spinner, retain the original transaction hash, retry transient RPC/rate-limit failures without replay, and clear only after finality, successful execution, and authoritative readback. The public Ledger loads every stored assessment through `get_revision` and exposes its revision ID, verdict, rationale, response source, and evidence digest without requiring a wallet. Fresh requests to `/`, `/workbench`, `/ledger`, and `/protocol` all return the SPA entry point with HTTP 200.

## Reproducible checks

Run from the repository root unless a command changes directory:

```powershell
py -3.13 scripts\genvm_lint_e.py check contracts\rule_response_ledger.py --json
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Current release results: GenVM lint/validation `3/3`, contract tests `1/1`, frontend tests `19/19`, Vite production build passed with 453 modules, and the high-severity production dependency audit reported zero vulnerabilities. The added regression test drives the production `readRecords` path with two stored revisions, proves both `get_revision(record_id, index)` calls occur, and asserts that verdict, rationale, response source, and evidence digest are rendered with escaped content. The wallet matrix covers EIP-6963/legacy deduplication in either announcement order, genuinely distinct EIP-6963 instances, connected/disconnected UI state, current SDK receipt shapes, transient RPC retry classification, and immediate pending notifications before and after wallet hash return. Desktop and 390×844 browser checks found no console errors or wallet auto-connection; both public Studionet records and their existing revisions loaded through the public Ledger.

## Deployment and source parity

The deployment transaction reached `FINALIZED`; Explorer reported consensus `Accepted`, GenVM reported `Contract deployed`, and the receipt reported `status: 0x1`. `gen_getContractCode` returned 13,756 decoded bytes whose SHA-256 equals the reviewed local contract hash. Finalized `get_upgrader()` returned the exact deployer/upgrader, and the initial finalized record count was zero.

An isolated rehearsal contract verified `upgrade(new_code)` through a normal full-consensus public-method call. The transaction reached `FINALIZED`, GenVM execution reported `SUCCESS`, reverse-decoded replacement bytes reproduced the reviewed source hash, and post-upgrade source and upgrader readbacks remained exact. The main release contract was not upgraded.

## Live proof matrix

| Path | Transaction | Terminal evidence | Authoritative readback |
|---|---|---|---|
| Deploy | [`0x638d…adf1`](https://explorer-studio.genlayer.com/tx/0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1) | `FINALIZED`, `Accepted`, contract deployed, receipt `0x1` | Code hash, upgrader, and initial count matched |
| Register | [`0x234e…59fb`](https://explorer-studio.genlayer.com/tx/0x234ecf1c0d8a5ddf4f09d6ba4c791340a577851508759159ce441ef2f3f359fb) | `FINALIZED`, receipt `0x1` | `RRL-000001`, correct registrant, `WAITING_FOR_FINAL_RULE`, count `1` |
| Bind canonical evidence | [`0x0a36…263d`](https://explorer-studio.genlayer.com/tx/0x0a3651fee804fae0d39c7c86e689261a8909fdaec5a9e33fe67e379e478e263d) | `FINALIZED`, `Accepted`, GenVM `SUCCESS`, receipt `0x1` | Status `READY`; all four evidence fields matched |
| Consensus assessment | [`0x0fde…ae87`](https://explorer-studio.genlayer.com/tx/0x0fdea75b646e22b26aab17e89c0794a318a86c37c815fa4a1c52f8a84549ae87) | `FINALIZED`, `Accepted`, five initial validators, GenVM `SUCCESS`, receipt `0x1` | Revision `RRL-000001-R01`; `UNRESOLVED / UNKNOWN / EVIDENCE_UNAVAILABLE` |
| User-wallet register | [`0x4ed2…8fe3`](https://explorer-studio.genlayer.com/tx/0x4ed278b6898ab93c300cdf8f6feb1edbe706f26ae0ae663ef0279a85d5d48fe3) | `FINALIZED`, `Accepted`, GenVM `SUCCESS` | `RRL-000002`; exact user-entered comment and issue; registrant `0xBf90…b40D` |
| User-wallet bind | [`0x5231…e0de`](https://explorer-studio.genlayer.com/tx/0x52317c8c9f54db959706c81f034280f4f019eff0bcdb0dae44ee71d8ac90e0de) | `FINALIZED`, `Accepted`, GenVM `SUCCESS` | `RRL-000002` advanced to `READY`; canonical evidence fields matched |
| User-wallet assessment | [`0x9653…3fa3`](https://explorer-studio.genlayer.com/tx/0x9653c3669abda8df6fa32fc12e4898fa227b3e035a8add25ff69eff664483fa3) | `FINALIZED`, `Accepted`, GenVM `SUCCESS` | `RRL-000002-R01`; `UNRESOLVED / UNKNOWN / EVIDENCE_UNAVAILABLE` |
| Authorized upgrade rehearsal | [`0xc465…7d1`](https://explorer-studio.genlayer.com/tx/0xc46534893211c9b8e93a57a18825a649644e25f5babbb482798fcdeb9acc57d1) | `FINALIZED`, `Accepted`, GenVM `SUCCESS`, receipt `0x1` | Exact source hash and upgrader preserved on rehearsal contract |

The assessment outcome is a verified fail-safe availability result. The Regulations.gov download host returned CloudFront `403`, so no substantive policy verdict is claimed.

## Steward request closure

| Steward request | Prior gap | Source and contract read path | Regression and live evidence |
|---|---|---|---|
| Let readers inspect an assessment revision's verdict, rationale, response source, and evidence digest. | The public Ledger loaded only `get_record`; `get_revision` was used only immediately after a new assessment write. | `readRecords` now enumerates `revision_count`, calls `get_revision(record_id, index)` for every stored revision, and renders the requested fields inline under the owning record. No contract or write-flow change was made. | Frontend test `public ledger loads every revision and renders its decision evidence` passes. The production stable alias loaded `RRL-000001-R01` and `RRL-000002-R01` from Studionet with all four requested fields and no browser console warnings or errors. |

## Known limitations

- The product is fixed to EPA docket `EPA-R03-OAR-2025-0174`.
- The current live state contains two verification records, including one complete guided user-wallet journey.
- Official-source availability can produce a safe `UNRESOLVED` result.
- The product is not legal advice, does not determine lawfulness, and transfers no real funds.
- The hosted build and guided wallet journey are verified; final completion still requires matching dual approval for the exact final package.
