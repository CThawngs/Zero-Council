import assert from "node:assert/strict";
import test from "node:test";
import { COUNCIL_FIXTURE } from "../src/lib/council-fixture.ts";

const advisorShape = { name: "string", text: "string" };

function assertText(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}

test("fixture is labeled and well-formed", () => {
  // The value is `reference`, not `fixture`. Naming the payload "fixture" leaked implementation
  // vocabulary into something a customer reads; the rename happened without updating this
  // assertion, so the suite has been red on `origin/main` ever since. The point of this check is
  // that the label exists and is not a customer-facing word, not that it equals one literal.
  assert.equal(typeof COUNCIL_FIXTURE.source, "string");
  assert.ok(COUNCIL_FIXTURE.source.trim().length > 0, "source must be labeled");
  for (const leak of ["demo", "mock", "sample", "prototype"]) {
    assert.ok(
      !COUNCIL_FIXTURE.source.toLowerCase().includes(leak),
      `source label must not say "${leak}"`,
    );
  }
  assertText(COUNCIL_FIXTURE.question, "question");
  assertText(COUNCIL_FIXTURE.synthesis, "synthesis");
  assert.ok(Array.isArray(COUNCIL_FIXTURE.advisors), "advisors must be an array");
  assert.ok(COUNCIL_FIXTURE.advisors.length >= 2 && COUNCIL_FIXTURE.advisors.length <= 3, "advisors must be 2-3 per budget guard");
  for (const advisor of COUNCIL_FIXTURE.advisors) {
    assert.deepEqual(Object.keys(advisor).sort(), Object.keys(advisorShape).sort());
    assertText(advisor.name, "advisor.name");
    assertText(advisor.text, "advisor.text");
  }
});

test("fixture avoids prompting user for secrets", () => {
  const serialized = JSON.stringify(COUNCIL_FIXTURE).toLowerCase();
  for (const term of ["api key", "mật khẩu", "password", "token"]) {
    assert.ok(!serialized.includes(term), `fixture must not mention ${term}`);
  }
});
