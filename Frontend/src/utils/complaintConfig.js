// Shared complaint dashboard configuration and formatting helpers.
export const departments = [
  "Electrical Maintenance",
  "Plumbing",
  "IT Support",
  "Civil Maintenance",
  "Housekeeping",
];

export const categoryDepartments = {
  Electrical: "Electrical Maintenance",
  Plumbing: "Plumbing",
  Internet: "IT Support",
  Cleaning: "Housekeeping",
  Furniture: "Civil Maintenance",
};

export const closedStatuses = ["Resolved", "Rejected", "Closed", "Withdrawn"];

export const assignedFilterStatuses = {
  current: ["Assigned", "Under_Review", "In_Progress", "On_Hold"],
  resolved: ["Resolved"],
  closed: ["Rejected", "Closed", "Withdrawn"],
};

export const ASSIGNED_PAGE_SIZE = 6;

export const assignedFilters = [
  { id: "current", label: "Current" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export const statusStyles = {
  Submitted: "bg-sky-50 text-sky-700",
  Under_Review: "bg-amber-50 text-amber-800",
  Assigned: "bg-indigo-50 text-indigo-700",
  In_Progress: "bg-blue-50 text-blue-700",
  On_Hold: "bg-orange-50 text-orange-800",
  Resolved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-700",
  Closed: "bg-slate-100 text-slate-700",
  Withdrawn: "bg-slate-100 text-slate-700",
};

export function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

export function formatStatus(status) {
  return (status || "Submitted").replaceAll("_", " ");
}
