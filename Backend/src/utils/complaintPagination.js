const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_SKIP = 1_000_000;

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function getPageOptions(query = {}) {
  const page = parsePositiveInteger(query.page, 1);
  const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_PAGE_SIZE);

  if (page === null || requestedLimit === null) {
    return {
      error: "Page and limit must be positive whole numbers.",
    };
  }

  const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_SKIP) {
    return { error: "The requested page is too far ahead." };
  }

  return {
    page,
    limit,
    skip,
  };
}

function getPageMetadata(page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

function makeSearchRegex(search) {
  if (typeof search !== "string") return null;

  const value = search.trim().slice(0, MAX_SEARCH_LENGTH);
  if (!value) return null;

  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

async function findStudentIdsBySearch(search, studentModel) {
  const regex = makeSearchRegex(search);
  if (!regex) return [];

  const searchText = search.trim();
  const numericRollNumber = /^\d+$/.test(searchText) ? Number(searchText) : null;
  const studentQuery = Number.isSafeInteger(numericRollNumber)
    ? { $or: [{ username: regex }, { rollno: numericRollNumber }] }
    : { username: regex };

  return studentModel.find(studentQuery).distinct("_id");
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SKIP,
  findStudentIdsBySearch,
  getPageMetadata,
  getPageOptions,
  makeSearchRegex,
};
