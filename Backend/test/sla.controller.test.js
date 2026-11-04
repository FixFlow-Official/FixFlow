const assert = require("node:assert/strict");
const test = require("node:test");
const { updateSlaPolicies } = require("../src/controllers/sla.controller");
const { DEFAULT_POLICIES } = require("../src/services/sla.service");

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("SLA target changes are restricted to administrators", async () => {
  const response = makeResponse();
  await updateSlaPolicies({ auth: { role: "staff" }, body: { policies: DEFAULT_POLICIES } }, response);

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.message, /Only administrators/);
});

test("rejects incomplete policy sets before writing", async () => {
  const response = makeResponse();
  await updateSlaPolicies({ auth: { id: "507f191e810c19729de860ea", role: "admin" }, body: { policies: [] } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /each complaint category/);
});

test("rejects invalid target ranges and reminder windows", async () => {
  const invalidPolicies = DEFAULT_POLICIES.map((policy) => ({ ...policy }));
  invalidPolicies[0].responseHours = 0;
  const response = makeResponse();
  await updateSlaPolicies({ auth: { id: "507f191e810c19729de860ea", role: "admin" }, body: { policies: invalidPolicies } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /Response/);
});
