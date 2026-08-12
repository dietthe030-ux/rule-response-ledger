import json


COMMENT_ID = "EPA-R03-OAR-2025-0174-0066"
COMMENT_URL = (
    "https://downloads.regulations.gov/"
    "EPA-R03-OAR-2025-0174-0066/attachment_1.pdf"
)
FINAL_NUMBER = "2025-12527"
FINAL_URL = "https://public-inspection.federalregister.gov/2025-12527.pdf"
RESPONSE_ID = "EPA-R03-OAR-2025-0174-0076"
RESPONSE_URL = (
    "https://downloads.regulations.gov/"
    "EPA-R03-OAR-2025-0174-0076/content.pdf"
)
ISSUE = "Whether West Virginia used enforceable reasonable-progress measures."


def register(ledger):
    return ledger.register_record(COMMENT_ID, COMMENT_URL, ISSUE)


def mock_evidence(direct_vm):
    direct_vm.mock_web(r".*0066/attachment_1\.pdf", {
        "status": 200,
        "body": "Comment asks EPA to require enforceable reasonable-progress measures.",
    })
    direct_vm.mock_web(r".*2025-12527\.pdf", {
        "status": 200,
        "body": "EPA approved the regional haze plan and explains the enforceable measures.",
    })
    direct_vm.mock_web(r".*0076/content\.pdf", {
        "status": 200,
        "body": "Response to comment 0066 addresses enforceability and explains the final action.",
    })


def warp(direct_vm, timestamp):
    direct_vm.warp(timestamp)
    # genlayer-test 0.29.2 refreshes typed message fields but not message_raw time.
    from genlayer import gl
    gl.message_raw["datetime"] = timestamp


def test_deterministic_state_machine(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_owner,
):
    direct_vm.warp("2026-08-13T00:00:00+00:00")
    ledger = direct_deploy("contracts/rule_response_ledger.py")
    warp(direct_vm, "2026-08-13T00:00:00+00:00")
    assert ledger.get_upgrader().lower() == f"0x{direct_owner.hex()}"

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("UPGRADE_NOT_AUTHORIZED"):
        ledger.upgrade(b"unauthorized-code")

    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("COMMENT_ID_INVALID"):
        ledger.register_record(f"{COMMENT_ID}9", f"{COMMENT_URL}9", ISSUE)

    with direct_vm.expect_revert("COMMENT_URL_MISMATCH"):
        ledger.register_record(COMMENT_ID, f"{COMMENT_URL}?download=1", ISSUE)

    record_id = register(ledger)

    record = json.loads(ledger.get_record(record_id))
    assert record["record_id"] == "RRL-000001"
    assert record["docket_id"] == "EPA-R03-OAR-2025-0174"
    assert record["comment_id"] == COMMENT_ID
    assert record["status"] == "WAITING_FOR_FINAL_RULE"
    assert record["registrant"].lower() == f"0x{direct_alice.hex()}"
    assert ledger.get_record_by_fingerprint(COMMENT_ID, f"  {ISSUE.upper()}  ") == record_id

    with direct_vm.expect_revert("DUPLICATE_RECORD"):
        register(ledger)

    with direct_vm.expect_revert("RECORD_NOT_ASSESSABLE"):
        ledger.assess_response(record_id)

    with direct_vm.expect_revert("FINAL_DOCUMENT_MISMATCH"):
        ledger.bind_final_evidence(record_id, "2025-00000", FINAL_URL, RESPONSE_ID, RESPONSE_URL)

    ledger.bind_final_evidence(
        record_id,
        FINAL_NUMBER,
        FINAL_URL,
        RESPONSE_ID,
        RESPONSE_URL,
    )

    record = json.loads(ledger.get_record(record_id))
    assert record["status"] == "READY"
    assert record["final_document_number"] == FINAL_NUMBER
    assert record["response_document_id"] == RESPONSE_ID

    with direct_vm.expect_revert("EVIDENCE_ALREADY_BOUND"):
        ledger.bind_final_evidence(record_id, FINAL_NUMBER, FINAL_URL, RESPONSE_ID, RESPONSE_URL)

    mock_evidence(direct_vm)
    addressed = {
        "verdict": "ADDRESSED",
        "follow_up_status": "NOT_REQUIRED",
        "issue_present": True,
        "response_source": "BOTH",
        "policy_change": False,
        "reason_code": "EXPLICIT_RESPONSE",
        "explanation": "The response document directly discusses the registered issue.",
    }
    direct_vm.mock_llm(r".*Return one JSON object.*", json.dumps(addressed))

    revision_id = ledger.assess_response(record_id)
    revision = json.loads(ledger.get_revision(record_id, 0))
    assert revision_id == "RRL-000001-R01"
    assert revision["verdict"] == "ADDRESSED"
    assert revision["follow_up_status"] == "NOT_REQUIRED"
    assert json.loads(ledger.get_record(record_id))["status"] == "ASSESSED"
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    mock_evidence(direct_vm)
    disputed = {**addressed, "verdict": "PARTIALLY_ADDRESSED", "follow_up_status": "REQUIRED"}
    direct_vm.mock_llm(r".*Return one JSON object.*", json.dumps(disputed))
    assert direct_vm.run_validator() is False

    direct_vm.clear_mocks()
    mock_evidence(direct_vm)
    invalid = {**addressed, "response_source": "NONE"}
    direct_vm.mock_llm(r".*Return one JSON object.*", json.dumps(invalid))
    assert direct_vm.run_validator() is False

    unresolved_id = ledger.register_record(
        COMMENT_ID,
        COMMENT_URL,
        "Whether the response explained how reasonable progress was measured.",
    )
    ledger.bind_final_evidence(
        unresolved_id,
        FINAL_NUMBER,
        FINAL_URL,
        RESPONSE_ID,
        RESPONSE_URL,
    )
    direct_vm.clear_mocks()
    unresolved_revision_id = ledger.assess_response(unresolved_id)
    unresolved = json.loads(ledger.get_revision(unresolved_id, 0))
    assert unresolved_revision_id == "RRL-000002-R01"
    assert unresolved["verdict"] == "UNRESOLVED"
    assert unresolved["follow_up_status"] == "UNKNOWN"
    assert json.loads(ledger.get_record(unresolved_id))["status"] == "UNRESOLVED"

    with direct_vm.expect_revert("RETRY_COOLDOWN_ACTIVE"):
        ledger.assess_response(unresolved_id)

    warp(direct_vm, "2026-08-13T01:00:00+00:00")
    assert ledger.assess_response(unresolved_id) == "RRL-000002-R02"
    warp(direct_vm, "2026-08-13T02:00:00+00:00")
    assert ledger.assess_response(unresolved_id) == "RRL-000002-R03"
    assert json.loads(ledger.get_record(unresolved_id))["attempt_count"] == 3
    assert ledger.get_record_count() == 2
    assert ledger.get_record_id(0) == record_id
    assert ledger.get_record_id(1) == unresolved_id

    warp(direct_vm, "2026-08-13T03:00:00+00:00")
    with direct_vm.expect_revert("ATTEMPT_LIMIT_REACHED"):
        ledger.assess_response(unresolved_id)

    direct_vm.sender = direct_owner
    rehearsal_code = b"authorized-rehearsal-code"
    ledger.upgrade(rehearsal_code)
    from genlayer import gl
    assert bytes(gl.storage.Root.get().code.get()) == rehearsal_code
