import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import ExpandableComplaintCard from "../components/complaints/ExpandableComplaintCard.jsx";
import ComplaintEmptyState from "../components/complaints/ComplaintEmptyState.jsx";
import StudentComplaintCard from "../features/student/StudentComplaintCard.jsx";
import StudentComplaintsPanel from "../features/student/StudentComplaintsPanel.jsx";
import StudentComplaintDetails from "../features/student/StudentComplaintDetails.jsx";
import StudentComplaintForm from "../features/student/StudentComplaintForm.jsx";
import ProfileSettings from "../components/profile/ProfileSettings.jsx";
import QrScannerModal from "../components/common/QrScannerModal.jsx";
import CampusTrendingFeed from "../features/student/CampusTrendingFeed.jsx";
import {
  ArrowLeft,
  ArrowUpRight,
  Flame,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  QrCode,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/useAuth.js";
import { useAssistantContext } from "../context/assistantContext.jsx";
import { downloadComplaintPdf } from "../utils/complaintPdf.js";
import { validateImageFile } from "../utils/fileValidation.js";
import {
  createComplaintRequest,
  getComplaintsRequest,
} from "../services/api.js";

const activeComplaintStatuses = [
  "Submitted",
  "Under_Review",
  "Assigned",
  "In_Progress",
  "On_Hold",
];

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [activeSection, setActiveSection] = useState("complaints");

  const [complaints, setComplaints] = useState([]);
  const [complaintPagination, setComplaintPagination] = useState(null);
  const [complaintCounts, setComplaintCounts] = useState({ current: 0, resolved: 0 });
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchParams] = useSearchParams();
  const initBuilding = searchParams.get("building") || "";
  const initFloor = searchParams.get("floor") || "Ground Floor";
  const initRoom = searchParams.get("room") || "";
  const isQrSource = searchParams.get("source") === "qr_door" || Boolean(initBuilding && initRoom);

  const [complaintSearch, setComplaintSearch] = useState("");
  const [page, setPage] = useState("create");
  const [complaintFilter, setComplaintFilter] = useState("current");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintPage, setComplaintPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [building, setBuilding] = useState(initBuilding);
  const [floor, setFloor] = useState(initFloor);
  const [room, setRoom] = useState(initRoom);
  const [image, setImage] = useState(null);
  const [qrPrefilled, setQrPrefilled] = useState(isQrSource);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  function handleQrScan(locationData) {
    if (locationData.building) setBuilding(locationData.building);
    if (locationData.floor) setFloor(locationData.floor);
    if (locationData.room) setRoom(locationData.room);
    setPage("create");
    setQrPrefilled(true);
  }

  const { setScreenContext } = useAssistantContext();

  useEffect(() => {
    setScreenContext({
      currentSection: `student-${activeSection}-${page}`,
      pageTitle: page === "create" ? "Submit New Complaint" : "My Complaints & Campus Facility Status",
      activeFilters: { page, complaintFilter, complaintSearch },
      selectedComplaint: selectedComplaint
        ? { id: selectedComplaint._id, title: selectedComplaint.title, status: selectedComplaint.status }
        : null,
      visibleComplaints: (complaints || []).slice(0, 10).map((c, index) => ({
        index: index + 1,
        id: c._id,
        title: c.title,
        category: c.category,
        status: c.status,
        building: c.building,
        room: c.room,
      })),
      formState: page === "create"
        ? {
            isOpen: true,
            title,
            category,
            building,
            floor,
            room,
            description,
            hasImage: Boolean(image),
          }
        : { isOpen: false },
      interactiveElements: [
        "complaintSearchInput",
        "filterPills: all, current, resolved, closed",
        "newComplaintButton",
        "complaintCards: view status and details",
        "complaintFormModal: title, category, building, floor, room, description, uploadProofImage, aiDiagnoseButton",
      ],
      availableActions: [
        "filter",
        "clearFilters",
        "navigate",
        "openComplaint",
        "openForm",
        "fillForm",
        "switchTab",
      ],
    });
  }, [
    activeSection,
    page,
    complaintFilter,
    complaintSearch,
    selectedComplaint,
    complaints,
    title,
    category,
    building,
    floor,
    room,
    description,
    image,
    setScreenContext,
  ]);

  useEffect(() => {
    function handleSetFilters(e) {
      const { status, search, view } = e.detail || {};
      if (view === "create" || view === "mine") setPage(view);
      if (status) setComplaintFilter(status);
      if (search !== undefined) setComplaintSearch(search);
    }

    function handleClearFilters() {
      setComplaintSearch("");
      setComplaintFilter("current");
    }

    function handleOpenComplaint(e) {
      const { id, index, title: targetTitle } = e.detail || {};
      let found = null;
      if (id) {
        found = complaints.find((c) => c._id === id);
      } else if (index !== undefined) {
        const idx = parseInt(index, 10) - 1;
        if (idx >= 0 && idx < complaints.length) {
          found = complaints[idx];
        }
      } else if (targetTitle) {
        found = complaints.find((c) =>
          c.title?.toLowerCase().includes(targetTitle.toLowerCase()),
        );
      }
      if (found) {
        setSelectedComplaint(found);
        setPage("mine");
      }
    }

    function handleOpenForm(e) {
      const { form } = e.detail || {};
      if (!form || form === "complaint") {
        setPage("create");
      }
    }

    function handleSwitchTab(e) {
      const { tab } = e.detail || {};
      if (tab === "create") setPage("create");
      else if (tab === "mine" || tab === "complaints") setPage("mine");
    }

    function handleFillForm(e) {
      const fields = e.detail || {};
      if (fields.title) setTitle(fields.title);
      if (fields.category) setCategory(fields.category);
      if (fields.building) setBuilding(fields.building);
      if (fields.floor) setFloor(fields.floor);
      if (fields.room) setRoom(fields.room);
      if (fields.description) setDescription(fields.description);
      setPage("create");
    }

    window.addEventListener("fixflow:set-filters", handleSetFilters);
    window.addEventListener("fixflow:clear-filters", handleClearFilters);
    window.addEventListener("fixflow:open-complaint", handleOpenComplaint);
    window.addEventListener("fixflow:open-form", handleOpenForm);
    window.addEventListener("fixflow:switch-tab", handleSwitchTab);
    window.addEventListener("fixflow:fill-complaint-form", handleFillForm);

    return () => {
      window.removeEventListener("fixflow:set-filters", handleSetFilters);
      window.removeEventListener("fixflow:clear-filters", handleClearFilters);
      window.removeEventListener("fixflow:open-complaint", handleOpenComplaint);
      window.removeEventListener("fixflow:open-form", handleOpenForm);
      window.removeEventListener("fixflow:switch-tab", handleSwitchTab);
      window.removeEventListener("fixflow:fill-complaint-form", handleFillForm);
    };
  }, [complaints]);

  // Debounce text search so each keystroke does not trigger a database query.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(complaintSearch.trim());
      setComplaintPage(1);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [complaintSearch]);

  // Keep the submission confirmation message visible for a short time.
  useEffect(() => {
    if (!successMessage) return undefined;
    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  // Fetch only the current server page. The home view requests its newest active item.
  useEffect(() => {
    if (page === "detail") return undefined;
    let active = true;

    async function loadComplaints() {
      setLoadingComplaints(true);
      setComplaintError("");

      try {
        const data = await getComplaintsRequest(accessToken, {
          view: page === "mine" ? complaintFilter : "active",
          page: page === "mine" ? complaintPage : 1,
          limit: 8,
          search: page === "mine" ? debouncedSearch : "",
        });

        if (active) {
          setComplaints(data.complaints ?? []);
          setComplaintPagination(data.pagination ?? null);
          setComplaintCounts(data.counts ?? { current: 0, resolved: 0 });
          if (
            page === "mine" &&
            data.pagination &&
            complaintPage > Math.max(1, data.pagination.totalPages)
          ) {
            setComplaintPage(Math.max(1, data.pagination.totalPages));
          }
        }
      } catch (error) {
        if (active) {
          setComplaintError(error.message || "Could not load your complaints.");
        }
      } finally {
        if (active) {
          setLoadingComplaints(false);
        }
      }
    }

    loadComplaints();

    return () => {
      active = false;
    };
  }, [accessToken, page, complaintFilter, complaintPage, debouncedSearch]);

  const newestActiveComplaint = complaints.find((complaint) =>
    activeComplaintStatuses.includes(complaint.status),
  );
  const filteredComplaints = complaints;

  // Student navigation handlers.
  function openMyComplaints() {
    setComplaintFilter("current");
    setComplaintPage(1);
    setSelectedComplaint(null);
    setPage("mine");
  }

  function openCreateComplaint() {
    setSelectedComplaint(null);
    setPage("create");
  }

  function openComplaintDetails(complaint) {
    setSelectedComplaint(complaint);
    setPage("detail");
  }

  // Validate the proof image selected in the submission form.
  function handleImageChange(event) {
    const selectedImage = event.target.files?.[0] ?? null;
    setFormError("");
    setSuccessMessage("");

    if (selectedImage) {
      const check = validateImageFile(selectedImage);
      if (!check.valid) {
        setImage(null);
        event.target.value = "";
        setFormError(check.error);
        return;
      }
    }

    setImage(selectedImage);
  }

  // Submit the student's complaint and refresh the complaint list.
  async function submitComplaint(draft, form = null) {
    const cleanTitle = draft.title.trim();
    const cleanDescription = draft.description.trim();
    const cleanBuilding = draft.building.trim();
    const cleanFloor = (draft.floor || floor || "Ground Floor").trim();
    const cleanRoom = (draft.room || "").trim();
    const complaintImage = draft.image || image;

    setFormError("");
    setSuccessMessage("");

    if (
      !cleanTitle ||
      !cleanDescription ||
      !draft.category ||
      !cleanBuilding ||
      !complaintImage
    ) {
      setFormError("Complete the required fields and attach a photo as proof.");
      return false;
    }

    setSubmitting(true);

    try {
      const result = await createComplaintRequest(
        {
          title: cleanTitle,
          description: cleanDescription,
          category: draft.category,
          building: cleanBuilding,
          floor: cleanFloor,
          room: cleanRoom,
          image: complaintImage,
          triageToken: draft.triageToken,
          confirmedCampusIssue: draft.confirmedCampusIssue,
          confirmDistinctIssue: draft.confirmDistinctIssue,
        },
        accessToken,
      );

      setSuccessMessage(result.message || "Complaint submitted successfully.");
      setTitle("");
      setDescription("");
      setCategory("");
      setBuilding("");
      setFloor("Ground Floor");
      setRoom("");
      setImage(null);
      form?.reset();

      try {
        const updatedData = await getComplaintsRequest(accessToken, {
          view: "active",
          page: 1,
          limit: 8,
        });
        setComplaints(updatedData.complaints ?? []);
        setComplaintPagination(updatedData.pagination ?? null);
        setComplaintCounts(updatedData.counts ?? { current: 0, resolved: 0 });
        setComplaintError("");
      } catch (error) {
        setComplaintError(
          error.message ||
            "Complaint submitted, but the list could not refresh.",
        );
      }
    } catch (error) {
      setFormError(error.message || "Could not submit the complaint.");
      return false;
    } finally {
      setSubmitting(false);
    }
    return true;
  }

  async function handleSubmit(event, confirmedCampusIssue = true, confirmDistinctIssue = false) {
    event.preventDefault();
    await submitComplaint({
      title,
      description,
      category,
      building,
      floor,
      room,
      image,
      confirmedCampusIssue,
      confirmDistinctIssue,
    }, event.currentTarget);
  }

  const firstName = user?.username?.trim()?.split(/\s+/)[0] || "there";



  // Fill complaint form fields via AI Assistant (Voice or Text)
  const handleFillFormFields = useCallback((fields) => {
    if (!fields) return;
    setActiveSection("complaints");
    openCreateComplaint();
    if (fields.title) setTitle(fields.title);
    if (fields.category) setCategory(fields.category);
    if (fields.building) setBuilding(fields.building);
    if (fields.floor) setFloor(fields.floor);
    if (fields.room) setRoom(fields.room);
    if (fields.description) setDescription(fields.description);
  }, []);

  useEffect(() => {
    function onFillEvent(event) {
      if (event?.detail) handleFillFormFields(event.detail);
    }
    window.addEventListener("fixflow:fill-complaint-form", onFillEvent);
    return () => window.removeEventListener("fixflow:fill-complaint-form", onFillEvent);
  }, [handleFillFormFields]);

  return (
    <DashboardShell
      workspaceLabel="Student"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onVoiceComplaintSubmit={submitComplaint}
      onFillFormFields={handleFillFormFields}
      assistantNavItems={[
        { id: "newComplaint", label: "New complaint" },
        { id: "myComplaints", label: "My complaints" },
        { id: "trendingFeed", label: "Campus trending" },
      ]}
      onAssistantNavigate={(item) => {
        if (item.id === "newComplaint" || item.id === "myComplaints" || item.id === "trendingFeed") {
          setActiveSection("complaints");
          if (item.id === "newComplaint") openCreateComplaint();
          else if (item.id === "trendingFeed") setPage("trending");
          else openMyComplaints();
        } else if (item.id === "trending") {
          setActiveSection("complaints");
          setPage("trending");
        } else setActiveSection(item.id);
      }}
      navItems={[
        { id: "complaints", label: "Complaints", icon: MessageSquareText },
        { id: "trending", label: "Campus Trending", icon: Flame },
        { id: "profile", label: "Profile", icon: UserRound },
      ]}
    >
      {activeSection === "profile" ? <ProfileSettings /> : (
      <div className="relative isolate mx-auto w-full max-w-none px-3 py-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[460px] before:bg-[radial-gradient(ellipse_at_top,_#e8f3ef_0%,_transparent_68%)] sm:px-6 sm:py-8 lg:px-8 xl:px-10">
        {page === "create" ? (
          <>
            <section className="relative mb-6 overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white via-white to-[#e9f4ef] px-5 py-6 shadow-[0_24px_70px_-40px_rgba(24,35,45,0.35)] ring-1 ring-line/70 sm:mb-8 sm:rounded-[2rem] sm:px-8 sm:py-9 lg:px-10">
              <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-soft/80 blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark">
                    <span className="size-1.5 rounded-full bg-brand" />
                    Student workspace
                  </span>
                  <h1 className="mt-4 break-words font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                    Hello, {firstName}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">
                    Report a campus issue and follow its progress from one
                    place.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPage("trending")}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/80 px-4 text-sm font-semibold text-amber-900 shadow-2xs transition hover:bg-amber-100 sm:w-auto"
                  >
                    <Flame size={16} className="text-amber-600" />
                    Trending Issues
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrScannerOpen(true)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-4 text-sm font-semibold text-brand shadow-xs transition hover:bg-brand hover:text-white sm:w-auto"
                  >
                    <QrCode size={16} /> Scan Door QR
                  </button>
                  <button
                    type="button"
                    onClick={openMyComplaints}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line/80 bg-white/85 px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-white hover:shadow-md sm:w-auto"
                  >
                    My complaints <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </section>

            <StudentComplaintForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              category={category}
              setCategory={setCategory}
              building={building}
              setBuilding={setBuilding}
              floor={floor}
              setFloor={setFloor}
              room={room}
              setRoom={setRoom}
              image={image}
              handleImageChange={handleImageChange}
              formError={formError}
              successMessage={successMessage}
              accessToken={accessToken}
              submitting={submitting}
              handleSubmit={handleSubmit}
              qrPrefilled={qrPrefilled}
              onOpenQrScanner={() => setQrScannerOpen(true)}
            />

            {qrScannerOpen && (
              <QrScannerModal
                onScan={handleQrScan}
                onClose={() => setQrScannerOpen(false)}
              />
            )}

            <section className="mt-6 w-full rounded-3xl border border-white/90 bg-white/95 p-4 shadow-[0_18px_55px_-36px_rgba(24,35,45,0.38)] ring-1 ring-line/70 sm:mt-8 sm:rounded-[1.75rem] sm:p-6 lg:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <MessageSquareText size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold">
                    Latest current complaint
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Your newest complaint being handled
                  </p>
                </div>
              </div>

              {loadingComplaints ? (
                <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-muted">
                  <LoaderCircle size={20} className="animate-spin text-brand" />
                  Loading complaints…
                </div>
              ) : complaintError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
                >
                  {complaintError}
                </p>
              ) : newestActiveComplaint ? (
                <StudentComplaintCard
                  complaint={newestActiveComplaint}
                  onOpen={openComplaintDetails}
                  onDownload={downloadComplaintPdf}
                />
              ) : (
                <ComplaintEmptyState
                  className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center"
                  titleClassName="mt-4 font-display font-bold"
                  descriptionClassName="mt-1 max-w-sm text-sm leading-6 text-muted"
                  icon={Inbox}
                  title="No complaints in progress"
                  description="Submit a complaint using the form. You can see all your complaints from My complaints."
                />
              )}
            </section>
          </>
        ) : page === "trending" ? (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setPage("create")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <ArrowLeft size={16} /> Back to report issue
            </button>
            <CampusTrendingFeed
              accessToken={accessToken}
              onSelectComplaint={openComplaintDetails}
            />
          </div>
        ) : page === "mine" ? (
          <StudentComplaintsPanel
            openCreateComplaint={openCreateComplaint}
            currentCount={complaintCounts.current}
            resolvedCount={complaintCounts.resolved}
            complaintFilter={complaintFilter}
            setComplaintFilter={(filter) => {
              setComplaintFilter(filter);
              setComplaintPage(1);
            }}
            complaintSearch={complaintSearch}
            setComplaintSearch={setComplaintSearch}
            loadingComplaints={loadingComplaints}
            complaintError={complaintError}
            filteredComplaints={filteredComplaints}
            openComplaintDetails={openComplaintDetails}
            downloadComplaintPdf={downloadComplaintPdf}
            pagination={complaintPagination}
            onPageChange={setComplaintPage}
          />
        ) : selectedComplaint ? (
          <ExpandableComplaintCard
            complaint={selectedComplaint}
            expanded
            onToggle={() => setPage("mine")}
            onDownloadPdf={downloadComplaintPdf}
            summary="Your complaint record, updates, and resolution details."
          >
            <StudentComplaintDetails
              complaint={selectedComplaint}
              accessToken={accessToken}
              onUpdate={(updated) => {
                setSelectedComplaint(updated);
                setComplaints((prev) =>
                  prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
                );
              }}
            />
          </ExpandableComplaintCard>
        ) : (
          <section className="w-full rounded-3xl border border-white/90 bg-white/95 p-6 text-center shadow-sm ring-1 ring-line/70 sm:p-8">
            <h1 className="font-display text-xl font-bold">
              Complaint not found
            </h1>
            <p className="mt-2 text-sm text-muted">
              It may have been removed from the list. Return to My complaints to
              choose another one.
            </p>
            <button
              type="button"
              onClick={() => setPage("mine")}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <ArrowLeft size={16} />
              My complaints
            </button>
          </section>
        )}
      </div>
      )}
    </DashboardShell>
  );
}
