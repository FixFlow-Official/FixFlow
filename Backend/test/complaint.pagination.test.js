const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SKIP,
  findStudentIdsBySearch,
  getPageMetadata,
  getPageOptions,
  makeSearchRegex,
} = require("../src/utils/complaintPagination");

test("uses safe defaults and clamps oversized page limits", () => {
  assert.deepEqual(getPageOptions({}), {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    skip: 0,
  });
  assert.deepEqual(getPageOptions({ page: "3", limit: "500" }), {
    page: 3,
    limit: MAX_PAGE_SIZE,
    skip: MAX_PAGE_SIZE * 2,
  });
});

test("rejects invalid page values and offsets that would scan too far", () => {
  assert.match(getPageOptions({ page: "0" }).error, /positive whole numbers/);
  assert.match(getPageOptions({ limit: "1.5" }).error, /positive whole numbers/);
  assert.match(
    getPageOptions({ page: String(MAX_SKIP + 2), limit: "1" }).error,
    /too far ahead/,
  );
});

test("builds pagination metadata for empty and non-empty result sets", () => {
  assert.deepEqual(getPageMetadata(2, 10, 21), {
    page: 2,
    limit: 10,
    total: 21,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true,
  });
  assert.deepEqual(getPageMetadata(1, 10, 0), {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
});

test("escapes user input before using it as a case-insensitive search regex", () => {
  const regex = makeSearchRegex("Room (A)+");
  assert.equal(regex.test("room (a)+"), true);
  assert.equal(regex.test("Room AAA"), false);
  assert.equal(makeSearchRegex("   "), null);
});

test("matches a student name and an exact numeric campus roll number", async () => {
  const queries = [];
  const studentModel = {
    find(query) {
      queries.push(query);
      return { distinct: async () => ["student-id"] };
    },
  };

  assert.deepEqual(await findStudentIdsBySearch("Amit", studentModel), ["student-id"]);
  assert.deepEqual(await findStudentIdsBySearch("12345", studentModel), ["student-id"]);
  assert.deepEqual(queries[0], { username: /Amit/i });
  assert.equal(queries[1].$or[1].rollno, 12345);
});
