param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$evidenceRoot = Join-Path $ProjectRoot '.evidence\PRE_DEPLOY'
$paths = @(
    'contracts/rule_response_ledger.py'
    'tests/conftest.py'
    'tests/direct/test_rule_response_ledger.py'
    'frontend/src/ledger.js'
    'frontend/src/main.js'
    'frontend/src/wallet.js'
    'frontend/tests/wallet.test.js'
    'README.md'
    'scripts/write-predeploy-manifest.ps1'
    '.evidence/PRE_DEPLOY/SPECIFICATION.md'
    '.evidence/PRE_DEPLOY/VERIFICATION.md'
    '.evidence/PRE_DEPLOY/CATEGORY_SCORECARD.md'
    '.evidence/PRE_DEPLOY/DRAFT_DEPLOYMENT_RECOVERY_MANIFEST.md'
)

$lines = foreach ($relative in $paths) {
    $native = Join-Path $ProjectRoot ($relative -replace '/', '\')
    if (-not (Test-Path -LiteralPath $native -PathType Leaf)) {
        throw "Required evidence file missing: $relative"
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $native).Hash.ToLowerInvariant()
    "$hash  $relative"
}

$manifest = Join-Path $evidenceRoot 'PACKAGE_MANIFEST.sha256'
$aggregate = Join-Path $evidenceRoot 'PACKAGE_AGGREGATE.sha256'
[IO.File]::WriteAllLines($manifest, $lines, [Text.UTF8Encoding]::new($false))
$manifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifest).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(
    $aggregate,
    "sha256(PACKAGE_MANIFEST.sha256)=$manifestHash`n",
    [Text.UTF8Encoding]::new($false)
)
Write-Output $manifestHash
