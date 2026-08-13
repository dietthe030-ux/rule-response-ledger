# Rule Response Ledger verification

This document consolidates reviewer-facing source, deployment, test, and live-path evidence. Internal checkpoint packages are intentionally excluded from the public repository.

## Exact source boundary

- Reviewed implementation/configuration commit: `5d8632fe9600336f7ace3a493545f2064cbb890b`
- Contract source SHA-256: `EDEB1E2690FCA5F4CE6B82D4035CF1A29CB7C6587FF3423108BF523126D34571`
- Network: Studionet, chain ID `61999`
- Main contract: [`0x18E2134c1b2D93170Aa35599a891F3785bB91f0a`](https://explorer-studio.genlayer.com/address/0x18E2134c1b2D93170Aa35599a891F3785bB91f0a)
- Deployment transaction: [`0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1`](https://explorer-studio.genlayer.com/tx/0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1)
- Deployer/upgrader: `0x3851587431CfD3e46D1eAa77c0aDc2AD35087040`
- Live web URL: [`https://rule-response-ledger.vercel.app`](https://rule-response-ledger.vercel.app)
- Vercel project: `dietthe030-uxs-projects/rule-response-ledger`
- Production deployment: `dpl_FHLF6Fcs1Wvtwk3tz4EKv2kNPSni`
- Immutable deployment URL: `https://rule-response-ledger-gtdhk8mey-dietthe030-uxs-projects.vercel.app`
- Compiled main asset SHA-256: `24D8084BB4483FC2FF9B468FB3CCB6578B21652B7190441F3E0E793845087829`

The public release commit is the branch tip named in the pre-push and final immutable evidence packages. Embedding that commit's own hash inside itself would be self-referential; the deployed contract remains byte-bound to the implementation commit and source hash above.

The production deployment is `READY`. Its stable alias and immutable URL serve the same compiled asset byte-for-byte as the verified local production build (396,981 bytes), contain the main contract address, and exclude the isolated rehearsal address. Fresh requests to `/`, `/workbench`, `/ledger`, and `/protocol` all return the SPA entry point with HTTP 200.

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

Current pre-push results: GenVM lint/validation `3/3`, contract tests `1/1`, frontend tests `12/12`, Vite production build passed with 453 modules, and the high-severity production dependency audit reported zero vulnerabilities. Desktop and 390×844 browser checks found no console errors, horizontal overflow, or wallet auto-connection; the public Studionet record loaded after authoritative readback.

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
| Authorized upgrade rehearsal | [`0xc465…7d1`](https://explorer-studio.genlayer.com/tx/0xc46534893211c9b8e93a57a18825a649644e25f5babbb482798fcdeb9acc57d1) | `FINALIZED`, `Accepted`, GenVM `SUCCESS`, receipt `0x1` | Exact source hash and upgrader preserved on rehearsal contract |

The assessment outcome is a verified fail-safe availability result. The Regulations.gov download host returned CloudFront `403`, so no substantive policy verdict is claimed.

## Known limitations

- The product is fixed to EPA docket `EPA-R03-OAR-2025-0174`.
- The current live state contains one verification record.
- Official-source availability can produce a safe `UNRESOLVED` result.
- The product is not legal advice, does not determine lawfulness, and transfers no real funds.
- The hosted build is verified, but final completion still requires the user's guided wallet test and matching dual approval.
