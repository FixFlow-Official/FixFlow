import { formatStatus, statusStyles } from "../../utils/complaintConfig.js";

/** Keep status labels and colors consistent across complaint cards. */
export default function ComplaintStatusBadge({ status, className = "" }) {
  const normalizedStatus = status || "Submitted";
  const colorClass =
    statusStyles[normalizedStatus] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colorClass} ${className}`.trim()}
    >
      {formatStatus(normalizedStatus)}
    </span>
  );
}
