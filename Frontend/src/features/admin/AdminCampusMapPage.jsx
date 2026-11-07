import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
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
  QrCode,
  RefreshCw,
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
import { useAssistantContext } from "../../context/assistantContext.jsx";
import RoomQrModal from "../../components/common/RoomQrModal.jsx";

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
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
  },
  blue: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
  },
  purple: {
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-800",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
  },
  rose: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-800",
  },
  cyan: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-700",
    badge: "bg-cyan-100 text-cyan-800",
  },
  indigo: {
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-800",
  },
};

export default function AdminCampusMapPage({ accessToken }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Centered Inspection Modal State (Card comes in center with blurred background)
  const [inspectingBlock, setInspectingBlock] = useState(null);
  const [selectedFloorName, setSelectedFloorName] = useState("");
  const [qrModal, setQrModal] = useState(null);

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [blockForm, setBlockForm] = useState({
    name: "",
    shortName: "",
    code: "",
    category: "Academic",
    accentColor: "purple",
    floors: [{ name: "Ground Floor", rooms: [] }],
    departments: [],
  });
  const [newRoomInputs, setNewRoomInputs] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadHeatmap(isRefresh = true) {
    if (isRefresh) setRefreshing(true);
    setError("");

    try {
      const res = await getCampusHeatmapRequest(accessToken);
      setData(res);
      // Keep inspecting block synced if open
      if (inspectingBlock) {
        const updated = res.blocks?.find((b) => b._id === inspectingBlock._id);
        if (updated) setInspectingBlock(updated);
      }
    } catch (err) {
      setError(err.message || "Could not load campus facility layout.");
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
          setError(err.message || "Could not load campus facility layout.");
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
    return blocks.filter((b) => {
      const matchesCategory = categoryFilter === "ALL" || b.category === categoryFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.shortName || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [blocks, categoryFilter, searchQuery]);

  const { setScreenContext } = useAssistantContext();

  useEffect(() => {
    setScreenContext({
      currentSection: "admin-campus-map",
      pageTitle: "Live Campus GIS Map & Facility Heatmap",
      activeFilters: { category: categoryFilter, search: searchQuery },
      selectedBuilding: inspectingBlock
        ? {
            name: inspectingBlock.name,
            code: inspectingBlock.code,
            category: inspectingBlock.category,
            floor: selectedFloorName,
            activeComplaints: inspectingBlock.activeComplaints || 0,
          }
        : null,
      visibleBuildings: (filteredBlocks || []).slice(0, 10).map((b, index) => ({
        index: index + 1,
        name: b.name,
        code: b.code,
        category: b.category,
        activeComplaints: b.activeComplaints,
      })),
      interactiveElements: [
        "categoryFilterPills: ALL, Academic, Lab, Administrative, Amenities, Sports",
        "searchBuildingsInput",
        "buildingCards: tap to view floor plan and active issues",
        "inspectionModal: floorSelector, roomList, directComplaintLinks",
        "addBuildingButton",
      ],
      availableActions: [
        "filter",
        "clearFilters",
        "selectBuilding",
        "selectFloor",
        "closeModal",
        "navigate",
      ],
    });
  }, [categoryFilter, searchQuery, inspectingBlock, selectedFloorName, filteredBlocks, setScreenContext]);

  useEffect(() => {
    function handleSetFilters(e) {
      const { category, search } = e.detail || {};
      if (category) setCategoryFilter(category);
      if (search !== undefined) setSearchQuery(search);
    }

    function handleClearFilters() {
      setCategoryFilter("ALL");
      setSearchQuery("");
    }

    function handleSelectBuilding(e) {
      const { id, name, code, index } = e.detail || {};
      let found = null;
      if (index !== undefined) {
        const idx = parseInt(index, 10) - 1;
        if (idx >= 0 && idx < filteredBlocks.length) {
          found = filteredBlocks[idx];
        }
      } else if (id || code) {
        found = blocks.find(
          (b) => b._id === id || b.code?.toLowerCase() === (id || code)?.toLowerCase(),
        );
      } else if (name) {
        found = blocks.find((b) =>
          b.name?.toLowerCase().includes(name.toLowerCase()),
        );
      }
      if (found) {
        setInspectingBlock(found);
        const floors = found.floorBreakdown || [];
        setSelectedFloorName(floors[0]?.name || "Ground Floor");
      }
    }

    function handleSelectFloor(e) {
      const { floor } = e.detail || {};
      if (floor) setSelectedFloorName(floor);
    }

    function handleCloseModal() {
      setInspectingBlock(null);
      setEditorOpen(false);
    }

    window.addEventListener("fixflow:set-filters", handleSetFilters);
    window.addEventListener("fixflow:clear-filters", handleClearFilters);
    window.addEventListener("fixflow:select-building", handleSelectBuilding);
    window.addEventListener("fixflow:select-floor", handleSelectFloor);
    window.addEventListener("fixflow:close-modal", handleCloseModal);

    return () => {
      window.removeEventListener("fixflow:set-filters", handleSetFilters);
      window.removeEventListener("fixflow:clear-filters", handleClearFilters);
      window.removeEventListener("fixflow:select-building", handleSelectBuilding);
      window.removeEventListener("fixflow:select-floor", handleSelectFloor);
      window.removeEventListener("fixflow:close-modal", handleCloseModal);
    };
  }, [blocks, filteredBlocks]);

  // Open centered inspection card
  function handleOpenInspect(block) {
    setInspectingBlock(block);
    const floors = block.floorBreakdown || [];
    setSelectedFloorName(floors[0]?.name || "Ground Floor");
  }

  // Open modal to create a new block
  function openCreateModal() {
    setEditingBlockId(null);
    setBlockForm({
      name: "",
      shortName: "",
      code: "",
      category: "Academic",
      accentColor: "purple",
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
      accentColor: block.accentColor || "purple",
      floors: block.floors?.length
        ? block.floors.map((f) => ({ name: f.name, rooms: [...(f.rooms || [])] }))
        : [{ name: "Ground Floor", rooms: [] }],
      departments: block.departments || [],
    });
    setNewRoomInputs({});
    setEditorOpen(true);
  }

  // Floor management in editor
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

  // Save Block
  async function handleSaveBlock(e) {
    e.preventDefault();
    if (!blockForm.name.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      if (editingBlockId) {
        await updateCampusBlockRequest(editingBlockId, blockForm, accessToken);
        setSuccessMessage("Building updated successfully.");
      } else {
        await createCampusBlockRequest(blockForm, accessToken);
        setSuccessMessage("Building added to campus.");
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
    if (!window.confirm("Remove this building from the campus facility directory?")) return;

    try {
      await deleteCampusBlockRequest(blockId, accessToken);
      setSuccessMessage("Building removed from campus.");
      if (inspectingBlock?._id === blockId) setInspectingBlock(null);
      await loadHeatmap(true);
    } catch (err) {
      setError(err.message || "Could not delete building.");
    }
  }

  // Reset to Pt. CLS Govt College Karnal preset
  async function handleResetKarnalPreset() {
    if (
      !window.confirm(
        "Reset and reload the official Pt. Chiranjilal Sharma Govt. College, Karnal campus layout?",
      )
    )
      return;

    try {
      setRefreshing(true);
      await initKarnalPresetRequest(accessToken);
      setSuccessMessage("Loaded Pt. CLS Govt College Karnal layout preset.");
      await loadHeatmap(true);
    } catch (err) {
      setError(err.message || "Could not load Karnal preset.");
    } finally {
      setRefreshing(false);
    }
  }

  // Current floor data for the centered inspection modal
  const inspectingFloors = inspectingBlock?.floorBreakdown || [];
  const currentInspectFloor =
    inspectingFloors.find((f) => f.name === selectedFloorName) || inspectingFloors[0];
  const InspectingIcon = inspectingBlock
    ? CATEGORY_ICONS[inspectingBlock.category] || Building2
    : Building2;
  const inspectingAccent = inspectingBlock
    ? ACCENT_COLORS[inspectingBlock.accentColor] || ACCENT_COLORS.purple
    : ACCENT_COLORS.purple;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-gradient-to-br from-white via-white to-brand-soft/20 p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between lg:p-8">
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
            Live Campus Facility Map
          </h1>
          <p className="mt-1 text-sm text-muted">
            Click on any building card to inspect its rooms, view active complaints, and navigate directly to them.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-dark transition"
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
            title="Refresh live data"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-brand" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted">Campus Buildings</p>
          <p className="mt-1 text-2xl font-black text-ink">{blocks.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted">Active Complaints</p>
          <p className="mt-1 text-2xl font-black text-brand-dark">
            {data?.totalActiveComplaints ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-rose-700">Systemic Hotspots</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black text-rose-900">
            {data?.systemicIncidentsCount ?? 0}
            {(data?.systemicIncidentsCount ?? 0) > 0 && (
              <span className="flex size-3 rounded-full bg-rose-500 animate-ping" />
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted">Quick Search</p>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search building..."
            className="mt-1 w-full text-xs font-semibold border-b border-dashed border-stone-300 pb-1 outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Messages */}
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
                ? "bg-ink text-white shadow-xs"
                : "border border-line bg-white text-muted hover:text-ink hover:bg-stone-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Map Effect Grid Container */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center gap-3 rounded-2xl sm:rounded-3xl border border-dashed border-line bg-canvas">
          <LoaderCircle size={24} className="animate-spin text-brand" />
          <span className="text-sm font-semibold text-muted">
            Loading Pt. CLS Govt College Karnal campus map…
          </span>
        </div>
      ) : (
        <div className="relative w-full rounded-2xl sm:rounded-3xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-3 sm:p-7 shadow-inner overflow-hidden">
          {/* Subtle Blueprint Grid Pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          {/* Central Campus Landmark Banner */}
          <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                <MapPin size={16} />
              </span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-ink">
                  Pt. Chiranjilal Sharma Govt. College Campus Facility Grid
                </h2>
                <p className="text-[10px] sm:text-[11px] text-muted">Sector 14, Karnal • Click any card to inspect rooms</p>
              </div>
            </div>

            <span className="rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-emerald-800">
              🌿 Central Campus & Academic Blocks
            </span>
          </div>

          {/* Building Cards Grid (Full width on mobile) */}
          <div className="relative z-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredBlocks.map((block) => {
              const Icon = CATEGORY_ICONS[block.category] || Building2;
              const accent = ACCENT_COLORS[block.accentColor] || ACCENT_COLORS.purple;
              const isDanger = block.heatLevel === "danger";
              const isWarning = block.heatLevel === "warning";
              const floors = block.floorBreakdown || [];

              return (
                <div
                  key={block._id}
                  onClick={() => handleOpenInspect(block)}
                  className={`group relative flex flex-col justify-between cursor-pointer rounded-2xl sm:rounded-3xl border-2 p-4 sm:p-6 transition-all duration-200 bg-white shadow-xs hover:shadow-md hover:-translate-y-0.5 w-full ${
                    isDanger
                      ? "border-rose-400 bg-rose-50/30 ring-1 ring-rose-200"
                      : isWarning
                        ? "border-amber-400 bg-amber-50/30 ring-1 ring-amber-200"
                        : "border-stone-200 hover:border-brand/40"
                  }`}
                >
                  {/* Danger Radar Ring when Systemic Anomaly detected */}
                  {isDanger && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex size-4 rounded-full bg-rose-600" />
                    </span>
                  )}

                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-10 sm:size-11 place-items-center rounded-xl sm:rounded-2xl ${accent.bg} ${accent.text}`}
                        >
                          <Icon size={18} className="sm:size-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted">
                              {block.code || block.category}
                            </span>
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                              {block.category}
                            </span>
                          </div>
                          <h3 className="mt-0.5 font-display text-base font-bold text-ink group-hover:text-brand-dark sm:text-lg">
                            {block.name}
                          </h3>
                        </div>
                      </div>

                      {/* Complaint Count Badge */}
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                          isDanger
                            ? "bg-rose-600 text-white animate-pulse"
                            : isWarning
                              ? "bg-amber-500 text-white"
                              : block.totalActive > 0
                                ? "bg-emerald-600 text-white"
                                : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {block.totalActive} {block.totalActive === 1 ? "complaint" : "complaints"}
                      </span>
                    </div>

                    {/* Systemic Hotspot Alert Banner */}
                    {block.systemicHotspot && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-100/90 px-3 py-2 text-xs font-bold text-rose-900 border border-rose-300">
                        <Flame size={14} className="shrink-0 text-rose-600" />
                        <span className="truncate">{block.systemicHotspot.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers size={14} />
                      {floors.length} {floors.length === 1 ? "Floor" : "Floors"} (
                      {floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0)} Rooms)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(block);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-stone-100 hover:text-ink transition"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(block._id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CENTERED INSPECTION MODAL (FULL SCREEN ON MOBILE) */}
      {inspectingBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md animate-fade-in"
          onClick={() => setInspectingBlock(null)}
        >
          <div
            className="relative h-full sm:h-auto sm:max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-line bg-white p-4 sm:p-8 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-11 sm:size-12 place-items-center rounded-xl sm:rounded-2xl ${inspectingAccent.bg} ${inspectingAccent.text}`}
                >
                  <InspectingIcon size={22} className="sm:size-6" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      {inspectingBlock.code || inspectingBlock.category}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">
                      {inspectingBlock.category}
                    </span>
                  </div>
                  <h2 className="mt-0.5 font-display text-lg sm:text-2xl font-black text-ink">
                    {inspectingBlock.name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-extrabold ${
                    inspectingBlock.totalActive > 0
                      ? inspectingBlock.heatLevel === "danger"
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-600 text-white"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {inspectingBlock.totalActive}{" "}
                  {inspectingBlock.totalActive === 1 ? "complaint" : "complaints"}
                </span>

                <button
                  type="button"
                  onClick={() => setInspectingBlock(null)}
                  className="grid size-9 place-items-center rounded-xl bg-stone-100 text-muted hover:bg-stone-200 hover:text-ink transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Systemic Hotspot Alert Banner */}
            {inspectingBlock.systemicHotspot && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-3.5 sm:p-4 text-xs font-bold text-rose-900 shadow-xs">
                <Flame size={20} className="shrink-0 text-rose-600" />
                <div>
                  <p className="font-extrabold text-sm">Systemic Facility Anomaly</p>
                  <p>{inspectingBlock.systemicHotspot.message}</p>
                </div>
              </div>
            )}

            {/* Floor Tabs */}
            <div className="mt-5 space-y-4 flex-1">
              <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
                <span className="text-xs font-bold text-muted mr-1">Select Floor:</span>
                {inspectingFloors.map((floor) => {
                  const isFloorActive = floor.name === (currentInspectFloor?.name || selectedFloorName);
                  return (
                    <button
                      key={floor.name}
                      type="button"
                      onClick={() => setSelectedFloorName(floor.name)}
                      className={`flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold transition ${
                        isFloorActive
                          ? "bg-ink text-white shadow-sm"
                          : "bg-white border border-line text-muted hover:text-ink hover:bg-stone-100"
                      }`}
                    >
                      <span>{floor.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          floor.count > 0
                            ? isFloorActive
                              ? "bg-rose-500 text-white"
                              : "bg-rose-100 text-rose-800"
                            : isFloorActive
                              ? "bg-white/20 text-white"
                              : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {floor.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Floor Rooms Grid (Full width per room card on mobile) */}
              {currentInspectFloor ? (
                <div className="space-y-4 pt-1 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                        Rooms & Facilities on {currentInspectFloor.name}
                      </h3>
                      <span className="text-xs font-semibold text-muted">
                        {currentInspectFloor.rooms?.length || 0} registered rooms
                      </span>
                    </div>
                    {currentInspectFloor.rooms?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQrModal({
                            buildingName: inspectingBlock.name,
                            buildingCode: inspectingBlock.code,
                            floorName: currentInspectFloor.name,
                            rooms: currentInspectFloor.rooms.map((r) => r.roomNumber),
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-xs transition hover:border-brand/40 hover:bg-canvas active:scale-95"
                      >
                        <QrCode size={13} className="text-brand" />
                        Print Floor Door QRs
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                    {(currentInspectFloor.rooms || []).map((room) => {
                      const hasComplaints = room.complaintsCount > 0;

                      return (
                        <div
                          key={room.roomNumber}
                          className={`rounded-2xl border p-4 transition-all w-full ${
                            hasComplaints
                              ? "border-rose-300 bg-white shadow-xs ring-1 ring-rose-200"
                              : "border-stone-200 bg-stone-50/60"
                          }`}
                        >
                          {/* Room Title & Badge */}
                          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                            <span className="font-display font-bold text-sm text-ink">
                              {room.roomNumber}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQrModal({
                                    buildingName: inspectingBlock.name,
                                    buildingCode: inspectingBlock.code,
                                    floorName: currentInspectFloor.name,
                                    room: room.roomNumber,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                                title="Print Door QR Code"
                              >
                                <QrCode size={11} />
                                Door QR
                              </button>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                                  hasComplaints
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {hasComplaints
                                  ? `${room.complaintsCount} active`
                                  : "✓ All Clear"}
                              </span>
                            </div>
                          </div>

                          {/* Complaints inside this Room */}
                          {hasComplaints ? (
                            <div className="mt-3 space-y-2">
                              {room.complaints.map((c) => (
                                <div
                                  key={c._id}
                                  onClick={() => navigate(`/admin/complaints/${c._id}`)}
                                  className="group/item flex cursor-pointer flex-col gap-1 rounded-xl border border-stone-100 bg-stone-50/80 p-2.5 transition hover:border-brand/40 hover:bg-brand-soft/40 hover:shadow-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-md bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
                                      {c.category}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        c.urgency === "Critical"
                                          ? "text-rose-600 font-extrabold"
                                          : c.urgency === "High"
                                            ? "text-amber-600"
                                            : "text-muted"
                                      }`}
                                    >
                                      {c.urgency}
                                    </span>
                                  </div>

                                  <p className="text-xs font-semibold text-ink line-clamp-1 group-hover/item:text-brand-dark">
                                    {c.title}
                                  </p>

                                  <div className="flex items-center justify-between pt-1 text-[11px] font-medium text-brand">
                                    <span>Open Complaint</span>
                                    <ArrowRight
                                      size={12}
                                      className="transition transform group-hover/item:translate-x-0.5"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs italic text-muted">
                              No open complaints reported in this room.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No floors configured for this building.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Building Modal (FULL SCREEN ON MOBILE) */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md">
          <div className="h-full sm:h-auto sm:max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-line bg-white p-4 sm:p-8 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {editingBlockId ? "Edit Building" : "Add New Building"}
                </h3>
                <p className="text-xs text-muted">
                  Configure building details, floors, and room numbers.
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
                    placeholder="e.g. PG Block or Commerce Block"
                    className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink">Short Display Name</label>
                  <input
                    type="text"
                    value={blockForm.shortName}
                    onChange={(e) => setBlockForm({ ...blockForm, shortName: e.target.value })}
                    placeholder="e.g. PG Block"
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
                    placeholder="e.g. PG-ARTS"
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

                      {/* Add Room input */}
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
                          placeholder="e.g. E1, E2, or Room 204 (press enter)"
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

              {/* Submit Buttons */}
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-dark transition disabled:opacity-50"
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
      {qrModal && (
        <RoomQrModal
          buildingName={qrModal.buildingName}
          buildingCode={qrModal.buildingCode}
          floorName={qrModal.floorName}
          room={qrModal.room}
          rooms={qrModal.rooms || []}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  );
}
