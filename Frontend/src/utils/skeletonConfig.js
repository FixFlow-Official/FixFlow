export const SKELETON_DEFAULTS = {
  cardCount: 3,
  tableRows: 4,
  tableCols: 5,
};

export function getSkeletonAriaAttributes(label = "Loading content") {
  return {
    role: "status",
    "aria-busy": "true",
    "aria-label": label,
  };
}
