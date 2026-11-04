"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { filteredRecords, parseCsv, toCsv } = require("../app.js");

const root = path.resolve(__dirname, "..");

test("sample data parses into all 500 valid reviews", () => {
  const parsed = parseCsv(fs.readFileSync(path.join(root, "analyzed_reviews.csv"), "utf8"));
  assert.equal(parsed.records.length, 500);
  assert.ok(parsed.headers.includes("sentiment"));
  assert.ok(parsed.headers.includes("confidence"));
  assert.ok(parsed.headers.includes("review"));
  assert.ok(parsed.records.every((record) => ["POSITIVE", "NEGATIVE"].includes(record.sentiment)));
  assert.ok(parsed.records.every((record) => record.confidence >= 0 && record.confidence <= 1));
  const confidence = parsed.records.map((record) => record.confidence);
  assert.equal(
    filteredRecords(parsed.records, new Set(["POSITIVE", "NEGATIVE"]), Math.min(...confidence), Math.max(...confidence)).length,
    500
  );
});

test("CSV parser handles BOMs, escaped quotes, commas, and newlines", () => {
  const csv = '\uFEFFsentiment,confidence,review\r\nPOSITIVE,0.9,"Nice, ""fast"" phone\nso far"\r\n';
  const parsed = parseCsv(csv);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].review, 'Nice, "fast" phone\nso far');
});

test("CSV parser reports missing columns, invalid scores, and malformed quoting", () => {
  assert.throws(() => parseCsv("sentiment,review\nPOSITIVE,Great"), /Missing required CSV column: confidence/);
  assert.throws(() => parseCsv("sentiment,confidence,review\nPOSITIVE,1.1,Great"), /Invalid confidence/);
  assert.throws(() => parseCsv('sentiment,confidence,review\nPOSITIVE,0.8,"unclosed'), /unclosed quoted field/);
});

test("filters match selected sentiment and inclusive confidence bounds", () => {
  const records = [
    { sentiment: "POSITIVE", confidence: 0.7 },
    { sentiment: "NEGATIVE", confidence: 0.8 },
    { sentiment: "POSITIVE", confidence: 0.9 }
  ];
  assert.deepEqual(
    filteredRecords(records, new Set(["POSITIVE"]), 0.7, 0.9),
    [records[0], records[2]]
  );
  assert.deepEqual(filteredRecords(records, new Set(), 0, 1), []);
});

test("filtered data exports as properly escaped CSV", () => {
  const record = { sentiment: "POSITIVE", confidence: 0.9, review: 'Nice, "fast" phone' };
  const csv = toCsv(["sentiment", "confidence", "review"], [record]);
  assert.deepEqual(parseCsv(csv).records, [record]);
});
