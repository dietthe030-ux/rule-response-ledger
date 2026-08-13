# Rule Response Ledger

Rule Response Ledger is a GenLayer dApp that records a material issue from a public rulemaking comment and produces an auditable signal about whether the final agency record substantively addressed it.

## Verified links

- [Studionet contract](https://explorer-studio.genlayer.com/address/0x18E2134c1b2D93170Aa35599a891F3785bB91f0a)
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1)
- Live app: pending the separately authorized Vercel deployment
- [Verification evidence](docs/VERIFICATION.md)

The MVP covers EPA docket [`EPA-R03-OAR-2025-0174`](https://www.regulations.gov/docket/EPA-R03-OAR-2025-0174). It is an evidence-navigation tool, not legal advice or a conclusion about whether an agency action is lawful.

## Trust problem

A commenter cannot credibly decide whether the agency addressed its own issue, while the agency is also an interested author of the final record. A conventional database can preserve documents but cannot independently compare their meaning. Rule Response Ledger constrains both sides to canonical public evidence and asks GenLayer validators to reach a semantic verdict before the result changes durable contract state.

## Why GenLayer is essential

The Intelligent Contract reads the registered comment attachment, final rule, and response-to-comments document with `gl.nondet.web.render`, then evaluates whether the issue was addressed. Validators independently rerun the evidence-grounded task and compare stable semantic fields rather than accepting JSON shape alone.

Consensus selects one of `ADDRESSED`, `PARTIALLY_ADDRESSED`, `NOT_ADDRESSED`, `OUT_OF_SCOPE`, or `UNRESOLVED`. Partial or negative responses set follow-up to `REQUIRED`; unavailable or contradictory evidence fails safely to `UNRESOLVED / UNKNOWN`. Removing web access, AI judgment, or validator consensus removes the product's core decision.

## How it works

1. A registrant connects an explicitly selected EIP-1193 wallet and registers a canonical Regulations.gov comment attachment plus a 20–360 character issue summary.
2. The registrant binds the fixed final-rule and response-to-comments documents.
3. Any connected user runs the consensus assessment across the three canonical sources.
4. Anyone reads the current record and immutable revision history without connecting a wallet.

## Architecture

- `contracts/rule_response_ledger.py` owns evidence constraints, record and revision state, nondeterministic evaluation, semantic validator agreement, retry limits, follow-up consequences, and upgrade authorization.
- `frontend/` uses `genlayer-js` for real Studionet reads and wallet-signed writes. It owns presentation, provider selection, transaction progress, reconciliation, and authoritative readback; it never invents a verdict.
- Canonical government documents remain off-chain public inputs. Their identifiers, URLs, issue summary, assessment revision, verdict, and follow-up state are bound or stored on-chain.
- There is no application backend, relayer, database, or off-chain AI decision service.

## Intelligent Contract

The main actors are the registrant, public readers, assessment callers, GenLayer validators, and the recorded Studio deployer/upgrader.

Key methods:

- `register_record` validates the fixed docket, canonical comment URL, issue length, and duplicate fingerprint.
- `bind_final_evidence` binds the fixed final-rule and response document to a waiting record.
- `assess_response` reads all evidence, evaluates it through validator consensus, appends a revision, and updates follow-up state.
- `get_record*`, `get_revision`, and `get_upgrader` expose authoritative public state.
- `upgrade` restricts source replacement to the recorded upgrader.

The only retry branch is `READY → UNRESOLVED → UNRESOLVED`, with a one-hour cooldown and a maximum of three assessment attempts.

## Transaction lifecycle

Wallet connection always opens an accessible provider chooser. MetaMask, OKX Wallet, Rabby, and other announced EIP-1193 providers are treated as distinct options; no provider is auto-selected. Every full reload starts disconnected and provider discovery sends no account request.

Each write records pending intent and the transaction hash, waits for `FINALIZED`, requires successful execution with a finalized consensus result, and performs method-specific contract readback before the UI announces success. Pending transactions can be reconciled after a reload without replaying the write.

## Run locally

Prerequisites are Python 3.13 and Node.js. Use the locked project manifests; no global dependency installation is required.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q

Set-Location frontend
npm ci
npm test
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env`. The example contains the verified Studionet contract address and no secret.

## Tests and verification

```powershell
py -3.13 scripts\genvm_lint_e.py check contracts\rule_response_ledger.py --json
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

The linter wrapper uses the governed GenVM runtime under `E:\Genlayer-Tools`; it does not download into the repository. Exact results and the live proof matrix are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Deployment

- Network: GenLayer Studionet only, chain ID `61999`
- Contract: `0x18E2134c1b2D93170Aa35599a891F3785bB91f0a`
- Deployment transaction: `0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1`
- Contract source SHA-256: `EDEB1E2690FCA5F4CE6B82D4035CF1A29CB7C6587FF3423108BF523126D34571`
- Deployer/upgrader: `0x3851587431CfD3e46D1eAa77c0aDc2AD35087040`

The deployment is finalized, its execution succeeded, deployed-source readback matches the reviewed source hash, and an isolated exact-source rehearsal verified the public upgrade authorization path. Studio account loss or a Studionet reset requires a replacement deployment and complete re-verification; the old address must not be represented as recoverable.

## Security and trust boundaries

- Canonical URL construction prevents a registrant from substituting a different docket or source.
- Deterministic guards reject malformed IDs, weak issue summaries, duplicates, invalid transitions, excess retries, and unauthorized upgrades before nondeterministic execution.
- Web failure, malformed model output, and disagreement fail closed without fabricating a substantive response verdict.
- Validators independently evaluate the same bounded evidence and compare consequential semantic fields.
- The frontend treats wallet providers, SDK results, receipts, and contract JSON as untrusted boundaries and publishes state only after authoritative readback.
- No key, credential, Studio secret, wallet export, or anonymous-review artifact is tracked.

## Known limitations

- The MVP is fixed to one EPA docket and its canonical final record.
- The only live record is the documented verification record `RRL-000001`.
- During live testing, the official Regulations.gov download host returned CloudFront `403`; the contract correctly recorded `UNRESOLVED / UNKNOWN / EVIDENCE_UNAVAILABLE` rather than a substantive policy conclusion.
- The project does not determine legality, compel an agency response, or transfer real funds.
- Upgrade recovery depends on continued access to the recorded Studio account and surviving Studionet state.
- The live Vercel URL will be added only after the user-authorized deployment is verified.
