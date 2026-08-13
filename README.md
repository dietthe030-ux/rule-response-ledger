# Rule Response Ledger

Rule Response Ledger is a fixed-scope GenLayer dApp that records one material issue from a public rulemaking comment and produces an auditable signal about whether the final agency record substantively addressed it.

The MVP covers EPA docket [`EPA-R03-OAR-2025-0174`](https://www.regulations.gov/docket/EPA-R03-OAR-2025-0174). It is an evidence-navigation tool, not legal advice and not a conclusion about whether an agency action is lawful.

## Why GenLayer

A normal database can preserve a claim, but it cannot make a credible semantic comparison across a comment, a final rule, and a response-to-comments document. The Intelligent Contract gives independent validators the same constrained evidence set and consequence map. Consensus decides which semantic verdict becomes the durable revision.

Possible verdicts are `ADDRESSED`, `PARTIALLY_ADDRESSED`, `NOT_ADDRESSED`, `OUT_OF_SCOPE`, and `UNRESOLVED`. Only partial or negative response signals set follow-up to `REQUIRED`; unavailable or contradictory evidence remains `UNRESOLVED`.

## Evidence flow

1. Register a canonical Regulations.gov comment attachment and a 20–360 character issue summary.
2. Bind the fixed final-rule and response-to-comments documents.
3. Run a consensus assessment across all three sources.
4. Read the current record and its immutable revision history without connecting a wallet.

Every frontend write waits for `FINALIZED`, checks `FINISHED_WITH_RETURN`, and performs method-specific authoritative readback. Pending intent and transaction hashes survive a page reload. Wallet connection always opens an explicit provider chooser.

## Stack

- Intelligent Contract: Python / GenVM
- Contract tests: `genlayer-test==0.29.2` Direct Mode
- Frontend: semantic HTML, CSS, JavaScript, Vite
- SDK: `genlayer-js==1.1.8`
- Network: GenLayer Studionet only (chain ID `61999`)

## Run locally

Python 3.13 and Node.js are used by the locked development environment.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q

Set-Location frontend
npm ci
npm test
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env`. It is pinned to the verified Studionet deployment at `0x18E2134c1b2D93170Aa35599a891F3785bB91f0a`.

## Verification

```powershell
py -3.13 scripts\genvm_lint_e.py check contracts\rule_response_ledger.py --json
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm test
npm run build
```

The linter wrapper uses the governed GenVM runtime under `E:\Genlayer-Tools`; it does not download into the repository.

## Canonical sources

- [Docket](https://www.regulations.gov/docket/EPA-R03-OAR-2025-0174)
- [Final document 2025-12527](https://public-inspection.federalregister.gov/2025-12527.pdf)
- [Response document EPA-R03-OAR-2025-0174-0076](https://downloads.regulations.gov/EPA-R03-OAR-2025-0174-0076/content.pdf)
- [GenLayer developer documentation](https://docs.genlayer.com/developers)

## Release status

Studionet contract: [`0x18E2134c1b2D93170Aa35599a891F3785bB91f0a`](https://explorer-studio.genlayer.com/address/0x18E2134c1b2D93170Aa35599a891F3785bB91f0a).

Deployment transaction: [`0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1`](https://explorer-studio.genlayer.com/tx/0x638d99b15edae6cf2d86a345c5964d5621caf1e1081c002c72b3ee1ce199adf1), finalized with successful execution and exact source-hash parity. The hosted frontend URL remains gated on independent review and target confirmation.
