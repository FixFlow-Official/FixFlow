import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  LoaderCircle,
  Plus,
  Radio,
  Trash2,
  Wifi,
  Zap,
  Droplet,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  getAdminBroadcastsRequest,
  createBroadcastRequest,
  updateBroadcastRequest,
  deleteBroadcastRequest,
  getCampusBlocksRequest,
} from "../../services/api.js";

const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Internet",
  "Furniture",
  "Other",
];

function formatDateTimeForInput(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCategoryIcon(cat) {
  switch (cat) {
    case "Electrical":
      return Zap;
    case "Plumbing":
      return Droplet;
    case "Internet":
      return Wifi;
    case "Cleaning":
      return Sparkles;
    default:
      return AlertTriangle;
  }
}

export default function AdminBroadcastsPage({ accessToken }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [campusBlocks, setCampusBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Electrical");
  const [isWholeCampus, setIsWholeCampus] = useState(true);
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [startsAt, setStartsAt] = useState(() => {
    const now = new Date();
    return formatDateTimeForInput(now);
  });
  const [endsAt, setEndsAt] = useState(() => {
    const end = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours later default
    return formatDateTimeForInput(end);
  });
  const [isActive, setIsActive] = useState(true);

  // Tab filter
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'active' | 'inactive'

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [broadcastsRes, blocksRes] = await Promise.all([
        getAdminBroadcastsRequest(accessToken),
        getCampusBlocksRequest(accessToken).catch(() => ({ blocks: [] })),
      ]);

      if (broadcastsRes?.broadcasts) {
        setBroadcasts(broadcastsRes.broadcasts);
      }
      if (blocksRes?.blocks && Array.isArray(blocksRes.blocks)) {
        setCampusBlocks(blocksRes.blocks);
      }
    } catch (err) {
      setError(err.message || "Failed to load campus broadcasts.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setCategory("Electrical");
    setIsWholeCampus(true);
    setSelectedBuildings([]);
    const now = new Date();
    setStartsAt(formatDateTimeForInput(now));
    setEndsAt(formatDateTimeForInput(new Date(now.getTime() + 4 * 60 * 60 * 1000)));
    setIsActive(true);
  }

  function handleEdit(broadcast) {
    setEditingId(broadcast._id);
    setTitle(broadcast.title || "");
    setMessage(broadcast.message || "");
    setCategory(broadcast.category || "Electrical");
    const hasBuildings = broadcast.buildings && broadcast.buildings.length > 0;
    setIsWholeCampus(!hasBuildings);
    setSelectedBuildings(hasBuildings ? broadcast.buildings : []);
    setStartsAt(formatDateTimeForInput(broadcast.startsAt));
    setEndsAt(formatDateTimeForInput(broadcast.endsAt));
    setIsActive(broadcast.isActive ?? true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBuildingToggle(buildingName) {
    setSelectedBuildings((prev) =>
      prev.includes(buildingName)
        ? prev.filter((b) => b !== buildingName)
        : [...prev, buildingName],
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!title.trim()) {
      setError("Please provide a broadcast title.");
      return;
    }
    if (!message.trim()) {
      setError("Please provide a broadcast description / notice.");
      return;
    }
    if (!startsAt || !endsAt) {
      setError("Please select both start and end dates/times.");
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (endDate <= startDate) {
      setError("End time must be after the start time.");
      return;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      category,
      buildings: isWholeCampus ? [] : selectedBuildings,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      isActive,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateBroadcastRequest(editingId, payload, accessToken);
        setSuccessMessage("Broadcast updated successfully.");
      } else {
        await createBroadcastRequest(payload, accessToken);
        setSuccessMessage("Campus outage broadcast published successfully.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save broadcast.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(broadcast) {
    setError("");
    try {
      await updateBroadcastRequest(
        broadcast._id,
        { isActive: !broadcast.isActive },
        accessToken,
      );
      setSuccessMessage(
        `Broadcast ${!broadcast.isActive ? "activated" : "deactivated"} successfully.`,
      );
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update broadcast status.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;
    setError("");
    try {
      await deleteBroadcastRequest(id, accessToken);
      setSuccessMessage("Broadcast deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete broadcast.");
    }
  }

  const now = new Date();
  const filteredBroadcasts = broadcasts.filter((b) => {
    const isCurrentlyActive =
      b.isActive && new Date(b.startsAt) <= now && new Date(b.endsAt) >= now;
    if (filterTab === "active") return isCurrentlyActive;
    if (filterTab === "inactive") return !isCurrentlyActive;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Radio size={20} />
            </span>
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Campus Outage Broadcasts & Banners
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Publish scheduled power, water, Wi-Fi, or facility outage notices across student and staff dashboards to prevent duplicate complaints.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Broadcast Creation / Edit Form */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-line pb-3.5">
          <h2 className="font-display text-base font-bold text-ink">
            {editingId ? "Edit Campus Outage Notice" : "Create New Outage Notice"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2">
              <label htmlFor="broadcast-title" className="block text-xs font-semibold text-ink">
                Outage Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="broadcast-title"
                type="text"
                maxLength={120}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Central Library Wi-Fi Maintenance"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
              <span className="mt-0.5 block text-right text-[11px] text-muted">
                {title.length}/120
              </span>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="broadcast-category" className="block text-xs font-semibold text-ink">
                Impacted Category <span className="text-rose-500">*</span>
              </label>
              <select
                id="broadcast-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Active Switch */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-stone-50 px-3.5 py-2">
              <div>
                <p className="text-xs font-semibold text-ink">Broadcast Status</p>
                <p className="text-[11px] text-muted">
                  {isActive ? "Active (visible to users)" : "Draft / Deactivated"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="text-brand transition-colors"
                aria-label="Toggle active status"
              >
                {isActive ? (
                  <ToggleRight size={32} className="text-emerald-600" />
                ) : (
                  <ToggleLeft size={32} className="text-stone-400" />
                )}
              </button>
            </div>

            {/* StartsAt */}
            <div>
              <label htmlFor="broadcast-starts" className="block text-xs font-semibold text-ink">
                Start Datetime <span className="text-rose-500">*</span>
              </label>
              <input
                id="broadcast-starts"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
            </div>

            {/* EndsAt */}
            <div>
              <label htmlFor="broadcast-ends" className="block text-xs font-semibold text-ink">
                Estimated Resolution Datetime <span className="text-rose-500">*</span>
              </label>
              <input
                id="broadcast-ends"
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
            </div>

            {/* Location / Buildings scope */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-ink">
                Affected Location Scope
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={isWholeCampus}
                    onChange={() => setIsWholeCampus(true)}
                    className="accent-brand"
                  />
                  <span>Whole Campus (All buildings)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={!isWholeCampus}
                    onChange={() => setIsWholeCampus(false)}
                    className="accent-brand"
                  />
                  <span>Specific Building(s)</span>
                </label>
              </div>

              {!isWholeCampus && (
                <div className="mt-2 rounded-xl border border-line bg-stone-50/60 p-3">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                    Select Affected Buildings:
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    {campusBlocks.length > 0 ? (
                      campusBlocks.map((block) => {
                        const isSelected = selectedBuildings.includes(block.name);
                        return (
                          <button
                            key={block._id || block.name}
                            type="button"
                            onClick={() => handleBuildingToggle(block.name)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                              isSelected
                                ? "bg-brand text-white shadow-xs"
                                : "bg-white border border-line text-ink hover:border-brand"
                            }`}
                          >
                            {block.name}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">No campus blocks found in system.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="sm:col-span-2">
              <label htmlFor="broadcast-msg" className="block text-xs font-semibold text-ink">
                Outage Description / Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="broadcast-msg"
                rows={3}
                maxLength={500}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain the cause, affected areas, and guidance for students and staff..."
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
              <span className="mt-0.5 block text-right text-[11px] text-muted">
                {message.length}/500
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-stone-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>{editingId ? "Update Outage Notice" : "Publish Outage Broadcast"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Broadcasts List Header & Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <h2 className="font-display text-base font-bold text-ink">
            Campus Broadcast Records ({broadcasts.length})
          </h2>

          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterTab === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              All ({broadcasts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("active")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterTab === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("inactive")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterTab === "inactive" ? "bg-white text-stone-700 shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Past / Inactive
            </button>
          </div>
        </div>

        {/* List of Broadcasts */}
        {loading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted">
            <LoaderCircle size={18} className="animate-spin text-brand" />
            <span>Loading outage broadcasts…</span>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <Radio size={28} className="mx-auto text-muted/60" />
            <p className="mt-2 text-sm font-semibold text-ink">No broadcast notices found</p>
            <p className="text-xs text-muted">
              {filterTab !== "all"
                ? "No broadcasts match the selected filter."
                : "Create your first outage notice above to broadcast scheduled maintenance."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBroadcasts.map((b) => {
              const Icon = getCategoryIcon(b.category);
              const isCurrentlyActive =
                b.isActive && new Date(b.startsAt) <= now && new Date(b.endsAt) >= now;

              return (
                <div
                  key={b._id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all ${
                    isCurrentlyActive
                      ? "border-amber-300 bg-amber-50/30 ring-1 ring-amber-300/40"
                      : "border-line bg-white opacity-85"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="grid size-6 place-items-center rounded-lg bg-stone-100 text-stone-700">
                          <Icon size={13} />
                        </span>
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-700">
                          {b.category}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isCurrentlyActive
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : b.isActive
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isCurrentlyActive
                              ? "bg-emerald-600 animate-pulse"
                              : b.isActive
                                ? "bg-amber-600"
                                : "bg-stone-400"
                          }`}
                        />
                        {isCurrentlyActive ? "Live Outage" : b.isActive ? "Scheduled" : "Deactivated"}
                      </span>
                    </div>

                    <h3 className="font-display text-sm font-bold text-ink line-clamp-2">
                      {b.title}
                    </h3>

                    <p className="text-xs text-muted line-clamp-3 leading-relaxed">
                      {b.message}
                    </p>

                    <div className="space-y-1 pt-1 text-[11px] text-muted border-t border-line/60">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-muted/80 shrink-0" />
                        <span>
                          {formatDisplayDate(b.startsAt)} — {formatDisplayDate(b.endsAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-muted/80 shrink-0" />
                        <span className="truncate">
                          {b.buildings && b.buildings.length > 0
                            ? b.buildings.join(", ")
                            : "Whole Campus"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(b)}
                      className={`text-xs font-semibold ${
                        b.isActive ? "text-amber-700 hover:text-amber-900" : "text-emerald-700 hover:text-emerald-900"
                      }`}
                    >
                      {b.isActive ? "Deactivate" : "Activate"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEdit(b)}
                        className="rounded-lg p-1.5 text-muted hover:bg-stone-100 hover:text-ink transition-colors"
                        aria-label="Edit broadcast"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b._id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                        aria-label="Delete broadcast"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
