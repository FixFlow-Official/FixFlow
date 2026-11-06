import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Coffee,
  Flame,
  FlaskConical,
  GraduationCap,
  Layers,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  getCampusHeatmapRequest,
  createCampusBlockRequest,
  updateCampusBlockRequest,
  deleteCampusBlockRequest,
  initKarnalPresetRequest,
} from "../../services/api.js";

const CATEGORY_ICONS = {
  Academic: GraduationCap,
  Lab: FlaskConical,
  Administrative: Building2,
  Amenities: Coffee,
  Sports: Trophy,
  Other: MapPin,
};

const ACCENT_COLORS = {
  emerald: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    glow: "shadow-emerald-500/10",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  blue: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    glow: "shadow-blue-500/10",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
  },
  purple: {
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-300",
    glow: "shadow-purple-500/10",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    glow: "shadow-amber-500/10",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
  },
  rose: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    glow: "shadow-rose-500/10",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
  },
  cyan: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-700 dark:text-cyan-300",
    glow: "shadow-cyan-500/10",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  indigo: {
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-300",
    glow: "shadow-indigo-500/10",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
};

export default function AdminCampusMapPage({ accessToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [viewMode, setViewMode] = useState("heatmap"); // "heatmap" | "builder"
  const [selectedBlock, setSelectedBlock] = useState(null);

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [blockForm, setBlockForm] = useState({
    name: "",
    shortName: "",
    code: "",
    category: "Academic",
    accentColor: "emerald",
    position: { x: 20, y: 20, width: 25, height: 25 },
    floors: [{ name: "Ground Floor", rooms: [] }],
    departments: [],
  });
  const [newRoomInputs, setNewRoomInputs] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Category filter for the map
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  async function loadHeatmap(isRefresh = true) {
    if (isRefresh) setRefreshing(true);
    setError("");

    try {
      const res = await getCampusHeatmapRequest(accessToken);
      setData(res);
      // Keep selected block updated if already selected
      if (selectedBlock) {
        const updated = res.blocks?.find((b) => b._id === selectedBlock._id);
        if (updated) setSelectedBlock(updated);
      }
    } catch (err) {
      setError(err.message || "Could not load campus spatial layout.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function fetchInitialHeatmap() {
      try {
        const res = await getCampusHeatmapRequest(accessToken);
        if (active) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load campus spatial layout.");
          setLoading(false);
        }
      }
    }

    fetchInitialHeatmap();

    return () => {
      active = false;
    };
  }, [accessToken]);

  const blocks = useMemo(() => data?.blocks || [], [data?.blocks]);

  const filteredBlocks = useMemo(() => {
    if (categoryFilter === "ALL") return blocks;
    return blocks.filter((b) => b.category === categoryFilter);
  }, [blocks, categoryFilter]);

  // Open modal to create a new block
  function openCreateModal() {
    setEditingBlockId(null);
    setBlockForm({
      name: "",
      shortName: "",
      code: "",
      category: "Academic",
      accentColor: "emerald",
      position: { x: 30, y: 30, width: 24, height: 26 },
      floors: [
        { name: "Ground Floor", rooms: ["Room 101", "Room 102"] },
        { name: "1st Floor", rooms: ["Room 201", "Room 202"] },
      ],
      departments: [],
    });
    setNewRoomInputs({});
    setEditorOpen(true);
  }

  // Open modal to edit an existing block
  function openEditModal(block) {
    setEditingBlockId(block._id);
    setBlockForm({
      name: block.name || "",
      shortName: block.shortName || "",
      code: block.code || "",
      category: block.category || "Academic",
      accentColor: block.accentColor || "emerald",
      position: {
        x: block.position?.x ?? 20,
        y: block.position?.y ?? 20,
        width: block.position?.width ?? 25,
        height: block.position?.height ?? 25,
      },
      floors: block.floors?.length
        ? block.floors.map((f) => ({ name: f.name, rooms: [...(f.rooms || [])] }))
        : [{ name: "Ground Floor", rooms: [] }],
      departments: block.departments || [],
    });
    setNewRoomInputs({});
    setEditorOpen(true);
  }

  // Handle floor management in the editor
  function addFloorToForm() {
    const floorNumber = blockForm.floors.length + 1;
    const name =
      floorNumber === 1
        ? "Ground Floor"
        : floorNumber === 2
          ? "1st Floor"
          : floorNumber === 3
            ? "2nd Floor"
            : `${floorNumber - 1}th Floor`;
    setBlockForm((prev) => ({
      ...prev,
      floors: [...prev.floors, { name, rooms: [] }],
    }));
  }

  function removeFloorFromForm(index) {
    if (blockForm.floors.length <= 1) return;
    setBlockForm((prev) => ({
      ...prev,
      floors: prev.floors.filter((_, i) => i !== index),
    }));
  }

  function addRoomToFloor(floorIndex) {
    const room = (newRoomInputs[floorIndex] || "").trim();
    if (!room) return;

    setBlockForm((prev) => {
      const floors = [...prev.floors];
      const currentRooms = floors[floorIndex].rooms || [];
      if (!currentRooms.includes(room)) {
        floors[floorIndex] = {
          ...floors[floorIndex],
          rooms: [...currentRooms, room],
        };
      }
      return { ...prev, floors };
    });

    setNewRoomInputs((prev) => ({ ...prev, [floorIndex]: "" }));
  }

  function removeRoomFromFloor(floorIndex, roomToRemove) {
    setBlockForm((prev) => {
      const floors = [...prev.floors];
      floors[floorIndex] = {
        ...floors[floorIndex],
        rooms: floors[floorIndex].rooms.filter((r) => r !== roomToRemove),
      };
      return { ...prev, floors };
    });
  }

  // Save Block (Create or Update)
  async function handleSaveBlock(e) {
    e.preventDefault();
    if (!blockForm.name.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      if (editingBlockId) {
        await updateCampusBlockRequest(editingBlockId, blockForm, accessToken);
        setSuccessMessage("Building layout updated successfully.");
      } else {
        await createCampusBlockRequest(blockForm, accessToken);
        setSuccessMessage("Building added to campus layout.");
      }
      setEditorOpen(false);
      await loadHeatmap(true);
    } catch (err) {
      setError(err.message || "Could not save building layout.");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Block
  async function handleDeleteBlock(blockId) {
    if (!window.confirm("Remove this building from the campus layout?")) return;

    try {
      await deleteCampusBlockRequest(blockId, accessToken);
      setSuccessMessage("Building removed from campus.");
      if (selectedBlock?._id === blockId) setSelectedBlock(null);
      await loadHeatmap(true);
    } catch (err) {
      setError(err.message || "Could not delete building.");
    }
  }

  // Reset to Pt. CLS Govt College Karnal preset
  async function handleResetKarnalPreset() {
    if (
      !window.confirm(
        "Reset and populate the complete Pt. Chiranjilal Sharma Govt. College, Karnal campus layout?",
      )
    )
      return;

    try {
      setRefreshing(true);
      await initKarnalPresetRequest(accessToken);
      setSuccessMessage("Initialized Pt. CLS Govt College Karnal layout preset.");
      await loadHeatmap(true);
    } catch (err) {
      setError(err.message || "Could not load Karnal preset.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-gradient-to-br from-white via-white to-brand-soft/20 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
              <MapPin size={13} />
              Sector 14, Karnal, Haryana
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Building2 size={13} />
              Pt. Chiranjilal Sharma Govt. College
            </span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
            Campus Spatial GIS & Real-Time Heatmap
          </h1>
          <p className="mt-1 text-sm text-muted">
            Live facility complaint density, systemic failure alerts, and real-time 2D block editor.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-line bg-stone-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("heatmap")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "heatmap"
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Flame size={14} className={viewMode === "heatmap" ? "text-amber-500" : ""} />
              Heatmap
            </button>
            <button
              type="button"
              onClick={() => setViewMode("builder")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "builder"
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Sliders size={14} className={viewMode === "builder" ? "text-brand-dark" : ""} />
              Map Builder
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition"
          >
            <Plus size={15} />
            Add Building
          </button>

          <button
            type="button"
            onClick={handleResetKarnalPreset}
            title="Reload official Pt. CLS Govt College Karnal layout"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted hover:bg-stone-50 hover:text-ink transition"
          >
            <Sparkles size={14} className="text-amber-500" />
            Karnal Preset
          </button>

          <button
            type="button"
            onClick={() => loadHeatmap(true)}
            disabled={refreshing}
            className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted hover:text-ink hover:bg-stone-50 transition disabled:opacity-50"
            title="Refresh live heatmap"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-brand" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted">Total Campus Blocks</p>
          <p className="mt-1 text-2xl font-black text-ink">{blocks.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted">Active Complaints</p>
          <p className="mt-1 text-2xl font-black text-brand-dark">
            {data?.totalActiveComplaints ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold text-rose-700">Systemic Incidents</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black text-rose-900">
            {data?.systemicIncidentsCount ?? 0}
            {(data?.systemicIncidentsCount ?? 0) > 0 && (
              <span className="flex size-3 rounded-full bg-rose-500 animate-ping" />
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted">Layout Mode</p>
          <p className="mt-1 text-sm font-bold capitalize text-ink">
            {viewMode === "heatmap" ? "🔴 Live Heatmap" : "🛠️ Editable Canvas"}
          </p>
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">Filter:</span>
        {["ALL", "Academic", "Lab", "Administrative", "Amenities", "Sports"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              categoryFilter === cat
                ? "bg-ink text-white shadow-sm"
                : "border border-line bg-white text-muted hover:text-ink hover:bg-stone-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 2D Interactive Campus Canvas */}
      {loading ? (
        <div className="flex min-h-[460px] items-center justify-center gap-3 rounded-3xl border border-dashed border-line bg-canvas">
          <LoaderCircle size={24} className="animate-spin text-brand" />
          <span className="text-sm font-semibold text-muted">
            Rendering Pt. CLS Govt College Karnal 2D Campus Map…
          </span>
        </div>
      ) : (
        <div className="relative min-h-[560px] w-full overflow-hidden rounded-3xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-4 shadow-inner">
          {/* Subtle Blueprint Grid Pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Center Campus Landmark: Lawn & Courtyard */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center rounded-3xl border border-emerald-300/60 bg-emerald-100/50 px-8 py-6 text-center shadow-sm">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800">
              🌿 Central Campus Lawn & Open Grounds
            </span>
            <span className="text-[11px] font-semibold text-emerald-700/80">
              Pt. Chiranjilal Sharma Govt. College, Karnal
            </span>
          </div>

          {/* Render 2D Positioned Buildings */}
          <div className="relative min-h-[520px] w-full">
            {filteredBlocks.map((block) => {
              const Icon = CATEGORY_ICONS[block.category] || Building2;
              const accent = ACCENT_COLORS[block.accentColor] || ACCENT_COLORS.emerald;
              const isDanger = block.heatLevel === "danger";
              const isWarning = block.heatLevel === "warning";
              const isSelected = selectedBlock?._id === block._id;

              return (
                <div
                  key={block._id}
                  onClick={() => setSelectedBlock(block)}
                  style={{
                    left: `${block.position?.x ?? 10}%`,
                    top: `${block.position?.y ?? 10}%`,
                    width: `${block.position?.width ?? 24}%`,
                    minHeight: `${(block.position?.height ?? 22) * 5}px`,
                  }}
                  className={`group absolute cursor-pointer rounded-2xl border-2 p-3.5 transition-all duration-200 select-none shadow-sm ${
                    isSelected
                      ? "ring-4 ring-brand/30 shadow-lg z-30"
                      : "hover:shadow-md hover:scale-[1.02] z-10"
                  } ${
                    isDanger
                      ? "border-rose-500 bg-rose-50/95 shadow-rose-500/20"
                      : isWarning
                        ? "border-amber-400 bg-amber-50/90 shadow-amber-500/10"
                        : "border-stone-200 bg-white"
                  }`}
                >
                  {/* Danger Radar Ring when Systemic Anomaly detected */}
                  {isDanger && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex size-4 rounded-full bg-rose-600" />
                    </span>
                  )}

                  {/* Block Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid size-7 place-items-center rounded-lg ${accent.bg} ${accent.text}`}
                      >
                        <Icon size={14} />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {block.code || block.category}
                      </span>
                    </div>

                    {/* Complaint Count Badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                        isDanger
                          ? "bg-rose-600 text-white"
                          : isWarning
                            ? "bg-amber-500 text-white"
                            : block.totalActive > 0
                              ? "bg-emerald-600 text-white"
                              : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {block.totalActive} {block.totalActive === 1 ? "issue" : "issues"}
                    </span>
                  </div>

                  {/* Building Title */}
                  <h3 className="mt-2 text-xs font-bold leading-tight text-ink group-hover:text-brand-dark sm:text-sm line-clamp-2">
                    {block.name}
                  </h3>

                  {/* Systemic Incident Alert Banner */}
                  {block.systemicHotspot && (
                    <div className="mt-2 flex items-center gap-1 rounded-lg bg-rose-100/90 px-2 py-1 text-[11px] font-bold text-rose-800">
                      <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                      <span className="truncate">{block.systemicHotspot.message}</span>
                    </div>
                  )}

                  {/* Floors & Rooms Summary */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <Layers size={11} />
                      {block.floors?.length || 1} {block.floors?.length === 1 ? "Floor" : "Floors"}
                    </span>

                    {viewMode === "builder" && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(block);
                          }}
                          className="rounded p-1 text-muted hover:text-ink hover:bg-stone-100"
                          title="Edit building"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBlock(block._id);
                          }}
                          className="rounded p-1 text-rose-600 hover:bg-rose-100"
                          title="Delete building"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Block Inspection Drawer */}
      {selectedBlock && (
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-dark">
                  {selectedBlock.category}
                </span>
                <span className="text-xs font-semibold text-muted">
                  Code: {selectedBlock.code || "N/A"}
                </span>
              </div>
              <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                {selectedBlock.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Pt. Chiranjilal Sharma Govt. College Karnal Facility Inspection
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedBlock)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-stone-50"
              >
                <Pencil size={13} />
                Edit Layout
              </button>
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="grid size-8 place-items-center rounded-xl text-muted hover:bg-stone-100 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Systemic Incident Highlight */}
          {selectedBlock.systemicHotspot && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
              <Flame size={20} className="shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Systemic Facility Anomaly Detected</p>
                <p className="text-xs text-rose-800">{selectedBlock.systemicHotspot.message}</p>
              </div>
            </div>
          )}

          {/* Floor & Room Breakdown */}
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-ink">Floor & Room Infrastructure</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(selectedBlock.floorBreakdown || []).map((floor) => (
                <div
                  key={floor.name}
                  className="rounded-2xl border border-line bg-stone-50/60 p-4 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">{floor.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                        floor.count > 0 ? "bg-brand text-white" : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {floor.count} {floor.count === 1 ? "active issue" : "active issues"}
                    </span>
                  </div>

                  {/* Registered Room Numbers */}
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-muted">Configured Rooms & Labs:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {floor.rooms?.length ? (
                        floor.rooms.map((room) => (
                          <span
                            key={room}
                            className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-ink"
                          >
                            {room}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] italic text-muted">No rooms specified</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Add / Edit Building Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {editingBlockId ? "Edit Building Layout" : "Add Building to Campus Map"}
                </h3>
                <p className="text-xs text-muted">
                  Configure building details, 2D canvas coordinates, floors, and rooms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="grid size-8 place-items-center rounded-xl text-muted hover:bg-stone-100 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBlock} className="mt-5 space-y-4">
              {/* Name & Short Name */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-ink">Building Full Name *</label>
                  <input
                    type="text"
                    required
                    value={blockForm.name}
                    onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                    placeholder="e.g. Commerce Block (Block B)"
                    className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink">Short Display Name</label>
                  <input
                    type="text"
                    value={blockForm.shortName}
                    onChange={(e) => setBlockForm({ ...blockForm, shortName: e.target.value })}
                    placeholder="e.g. Commerce Block"
                    className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Code, Category & Color */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-ink">Building Code</label>
                  <input
                    type="text"
                    value={blockForm.code}
                    onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })}
                    placeholder="e.g. COMM-B"
                    className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2 text-sm uppercase outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink">Category</label>
                  <select
                    value={blockForm.category}
                    onChange={(e) => setBlockForm({ ...blockForm, category: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Lab">Lab</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Amenities">Amenities</option>
                    <option value="Sports">Sports</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink">Accent Color</label>
                  <select
                    value={blockForm.accentColor}
                    onChange={(e) => setBlockForm({ ...blockForm, accentColor: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand capitalize"
                  >
                    {Object.keys(ACCENT_COLORS).map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2D Canvas Position Controls */}
              <div className="rounded-2xl border border-line bg-stone-50/60 p-4">
                <p className="text-xs font-bold text-ink">
                  2D Campus Canvas Coordinates (% of Map)
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-[11px] font-semibold text-muted">
                      X Position ({blockForm.position.x}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={75}
                      value={blockForm.position.x}
                      onChange={(e) =>
                        setBlockForm({
                          ...blockForm,
                          position: { ...blockForm.position, x: Number(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted">
                      Y Position ({blockForm.position.y}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={75}
                      value={blockForm.position.y}
                      onChange={(e) =>
                        setBlockForm({
                          ...blockForm,
                          position: { ...blockForm.position, y: Number(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted">
                      Width ({blockForm.position.width}%)
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={45}
                      value={blockForm.position.width}
                      onChange={(e) =>
                        setBlockForm({
                          ...blockForm,
                          position: { ...blockForm.position, width: Number(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted">
                      Height ({blockForm.position.height}%)
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={40}
                      value={blockForm.position.height}
                      onChange={(e) =>
                        setBlockForm({
                          ...blockForm,
                          position: { ...blockForm.position, height: Number(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Floors & Rooms Builder */}
              <div className="rounded-2xl border border-line bg-stone-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ink">Floors & Room Numbers</p>
                  <button
                    type="button"
                    onClick={addFloorToForm}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-ink border border-line hover:bg-stone-100"
                  >
                    <Plus size={13} /> Add Floor
                  </button>
                </div>

                <div className="space-y-3">
                  {blockForm.floors.map((floor, floorIdx) => (
                    <div
                      key={floorIdx}
                      className="rounded-xl border border-line bg-white p-3 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          required
                          value={floor.name}
                          onChange={(e) => {
                            const floors = [...blockForm.floors];
                            floors[floorIdx].name = e.target.value;
                            setBlockForm({ ...blockForm, floors });
                          }}
                          className="font-bold text-xs text-ink border-b border-dashed border-stone-300 pb-0.5 outline-none focus:border-brand"
                        />
                        {blockForm.floors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFloorFromForm(floorIdx)}
                            className="text-muted hover:text-rose-600 text-xs"
                          >
                            Remove Floor
                          </button>
                        )}
                      </div>

                      {/* Room Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {floor.rooms?.map((room) => (
                          <span
                            key={room}
                            className="inline-flex items-center gap-1 rounded-md border border-line bg-stone-50 px-2 py-0.5 text-xs text-ink"
                          >
                            {room}
                            <button
                              type="button"
                              onClick={() => removeRoomFromFloor(floorIdx, room)}
                              className="text-stone-400 hover:text-rose-600"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Add Room to this floor */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newRoomInputs[floorIdx] || ""}
                          onChange={(e) =>
                            setNewRoomInputs({ ...newRoomInputs, [floorIdx]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addRoomToFloor(floorIdx);
                            }
                          }}
                          placeholder="e.g. Room 204 or Physics Lab (press enter)"
                          className="flex-1 rounded-lg border border-line px-2.5 py-1 text-xs outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => addRoomToFloor(floorIdx)}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-stone-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-muted hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {editingBlockId ? "Save Changes" : "Create Building"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
