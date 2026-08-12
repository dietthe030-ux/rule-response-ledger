import test from "node:test";
import assert from "node:assert/strict";
import { DOCKET_ID, canonicalCommentUrl, parseStoredJson, validContractAddress } from "../src/ledger.js";

test("canonical comment evidence is fixed to the docket download path", () => {
  assert.equal(canonicalCommentUrl(`${DOCKET_ID}-0066`), `https://downloads.regulations.gov/${DOCKET_ID}-0066/attachment_1.pdf`);
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
