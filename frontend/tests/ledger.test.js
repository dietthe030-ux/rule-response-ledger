import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCKET_ID,
  EXPLORER,
  canonicalCommentUrl,
  parseStoredJson,
  readRecords,
  recordMarkup,
  validContractAddress,
} from "../src/ledger.js";

test("canonical comment evidence is fixed to the docket download path", () => {
  assert.equal(canonicalCommentUrl(`${DOCKET_ID}-0066`), `https://downloads.regulations.gov/${DOCKET_ID}-0066/attachment_1.pdf`);
  assert.equal(canonicalCommentUrl(""), "");
  assert.equal(canonicalCommentUrl(`${DOCKET_ID}-66`), "");
});

test("only full contract addresses pass configuration validation", () => {
  assert.equal(validContractAddress(`0x${"a".repeat(40)}`), true);
  assert.equal(validContractAddress("0x1234"), false);
  assert.equal(validContractAddress(""), false);
});

test("stored JSON readback must be a string", () => {
  assert.deepEqual(parseStoredJson('{"status":"READY"}'), { status: "READY" });
  assert.throws(() => parseStoredJson({ status: "READY" }), /unexpected/);
});

test("rendered Explorer links use the current Studionet endpoint", () => {
  assert.equal(EXPLORER, "https://explorer-studio.genlayer.com");
});

test("public ledger loads every revision and renders its decision evidence", async () => {
  const calls = [];
  const revisions = [
    {
      revision_id: "RRL-000001-R01",
      verdict: "UNRESOLVED",
      explanation: "One or more required official sources were unavailable.",
      response_source: "NONE",
      evidence_digest: "",
    },
    {
      revision_id: "RRL-000001-R02",
      verdict: "ADDRESSED",
      explanation: "The final rule & response address the registered issue.",
      response_source: "BOTH",
      evidence_digest: "a".repeat(64),
    },
  ];
  const client = {
    async readContract(call) {
      calls.push(call);
      if (call.functionName === "get_record_count") return 1;
      if (call.functionName === "get_record_id") return "RRL-000001";
      if (call.functionName === "get_record") return JSON.stringify({
        record_id: "RRL-000001",
        issue_summary: "A material issue",
        comment_id: `${DOCKET_ID}-0066`,
        revision_count: 2,
        follow_up_status: "NOT_REQUIRED",
        status: "ASSESSED",
        current_revision_id: "RRL-000001-R02",
      });
      if (call.functionName === "get_revision") return JSON.stringify(revisions[call.args[1]]);
      throw new Error(`Unexpected call ${call.functionName}`);
    },
  };

  const [record] = await readRecords(`0x${"a".repeat(40)}`, client);
  assert.deepEqual(record.revisions, revisions);
  assert.deepEqual(
    calls.filter(({ functionName }) => functionName === "get_revision").map(({ args }) => args),
    [["RRL-000001", 0], ["RRL-000001", 1]],
  );

  const markup = recordMarkup(record);
  assert.match(markup, /RRL-000001-R01/);
  assert.match(markup, /Verdict[\s\S]*UNRESOLVED/);
  assert.match(markup, /Rationale[\s\S]*official sources were unavailable/);
  assert.match(markup, /Response source[\s\S]*BOTH/);
  assert.match(markup, new RegExp(`Evidence digest[\\s\\S]*${"a".repeat(64)}`));
  assert.match(markup, /final rule &amp; response/);
});
