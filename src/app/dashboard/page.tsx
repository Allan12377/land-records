"use client";

import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileImage,
  FileText,
  Filter,
  FileUp,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

type AppView = "records" | "districts" | "documents";
type ReviewStatus = "Verified" | "Needs review" | "Scan pending";
type RecordDocument = {
  id: string;
  category: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  upload_status: string;
  created_at: string;
};
type ListedDocument = RecordDocument & {
  full_name: string | null;
  record_number: string | null;
  title_reference: string | null;
  district: string | null;
};
type ActivityItem = { id: string; initials: string; action: string; target: string; time: string; tone: string };

type RegistryRecord = {
  id: string;
  personId: string;
  recordNumber: string;
  name: string;
  otherNames: string;
  titleRef: string;
  region: string;
  district: string;
  county: string;
  subCounty: string;
  parish: string;
  village: string;
  contact: string;
  landSize: string;
  landSizeValue: string;
  landSizeUnit: string;
  source: string;
  sourceBook: string;
  sourcePage: string;
  status: ReviewStatus;
  updated: string;
  initials: string;
  tint: string;
};

const initialRecords: RegistryRecord[] = [];
const viewLabels: Record<AppView, { title: string; subtitle: string }> = {
  records: { title: "Land registry", subtitle: "A clear view of people, parcels, and source records." },
  districts: { title: "Districts", subtitle: "Browse the registry by district and local area." },
  documents: { title: "Source documents", subtitle: "Track scanned book pages and verification status." },
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const Icon = status === "Verified" ? BadgeCheck : status === "Needs review" ? CircleAlert : Clock3;
  return (
    <span className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}>
      <Icon size={13} strokeWidth={2} />
      {status}
    </span>
  );
}

function Initials({ value, tint }: { value: string; tint: string }) {
  return <span className={`initials initials-${tint}`}>{value}</span>;
}

function fromApiRecord(row: Record<string, unknown>): RegistryRecord {
  const name = String(row.full_name ?? "Unknown person");
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const tints = ["mint", "peach", "blue", "lavender", "yellow"];
  const tint = tints[(name.length + String(row.parcel_id ?? "").length) % tints.length];
  const status: ReviewStatus = row.verification_status === "verified" ? "Verified" : row.verification_status === "scan_pending" ? "Scan pending" : "Needs review";
  const book = row.source_book ? `Book ${String(row.source_book)}` : "No book reference";
  const page = row.source_page ? `Page ${String(row.source_page)}` : "Page not entered";
  const landSize = row.land_size ? `${row.land_size} ${String(row.land_size_unit ?? "")}`.trim() : "Not recorded";
  const updated = row.updated_at ? new Date(String(row.updated_at)).toLocaleString() : "Not available";
  return {
    id: String(row.parcel_id),
    personId: String(row.person_id),
    recordNumber: String(row.record_number),
    name,
    otherNames: String(row.other_names ?? ""),
    titleRef: String(row.title_reference ?? "Not entered"),
    region: String(row.region ?? ""),
    district: String(row.district ?? "Not entered"),
    county: String(row.county ?? "Not entered"),
    subCounty: String(row.sub_county ?? "Not entered"),
    parish: String(row.parish ?? "Not entered"),
    village: String(row.village ?? "Not entered"),
    contact: String(row.contact_phone ?? "Not entered"),
    landSize,
    landSizeValue: row.land_size == null ? "" : String(row.land_size),
    landSizeUnit: String(row.land_size_unit ?? "unknown"),
    source: `${book} · ${page}`,
    sourceBook: String(row.source_book ?? ""),
    sourcePage: String(row.source_page ?? ""),
    status,
    updated,
    initials,
    tint,
  };
}

export default function Home() {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unconfigured" | "signed-out">("loading");
  const [adminName, setAdminName] = useState("");
  const [districts, setDistricts] = useState<{ district: string; parcel_count: number }[]>([]);
  const [summary, setSummary] = useState({ people_count: 0, parcel_count: 0, verified_count: 0, attention_count: 0, district_count: 0, document_count: 0 });
  const [totalMatches, setTotalMatches] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageError, setPageError] = useState("");
  const [activeView, setActiveView] = useState<AppView>("records");
  const [search, setSearch] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("All districts");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RegistryRecord | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RegistryRecord | null>(null);
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [documentList, setDocumentList] = useState<ListedDocument[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(search);
  const filteredRecords = records;
  const verifiedCount = summary.verified_count;
  const reviewCount = summary.attention_count;

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (response.status === 503) {
          if (!cancelled) setSessionState("unconfigured");
          return;
        }
        if (response.status === 401) {
          router.replace("/login");
          if (!cancelled) setSessionState("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Unable to verify administrator session.");
        const data = await response.json() as { user: { name: string } };
        if (cancelled) return;
        setAdminName(data.user.name);
        setSessionState("ready");
        const [districtResponse, summaryResponse] = await Promise.all([
          fetch("/api/districts", { cache: "no-store" }),
          fetch("/api/summary", { cache: "no-store" }),
        ]);
        if (districtResponse.ok) setDistricts((await districtResponse.json()).districts);
        if (summaryResponse.ok) setSummary(await summaryResponse.json());
      } catch {
        if (!cancelled) setPageError("Could not connect to the registry service.");
      }
    }
    void checkSession();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (sessionState !== "ready") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPageError("");
      setLoadingRecords(true);
      const params = new URLSearchParams({ limit: "25", offset: String(pageOffset) });
      if (deferredSearch.trim()) params.set("q", deferredSearch.trim());
      if (selectedDistrict !== "All districts") params.set("district", selectedDistrict);
      if (selectedStatus) params.set("status", selectedStatus);
      try {
        const response = await fetch(`/api/records?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("Registry search failed.");
        const data = await response.json() as { records: Record<string, unknown>[]; total: number };
        setRecords(data.records.map(fromApiRecord));
        setTotalMatches(data.total);
      } catch (error) {
        if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : "Registry search failed.");
      } finally {
        if (!controller.signal.aborted) setLoadingRecords(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sessionState, deferredSearch, selectedDistrict, selectedStatus, pageOffset, refreshKey, router]);

  useEffect(() => {
    if (sessionState !== "ready") return;
    let cancelled = false;
    Promise.all([
      fetch("/api/audit?limit=5", { cache: "no-store" }).then((response) => response.ok ? response.json() : { events: [] }),
      fetch("/api/documents?limit=25", { cache: "no-store" }).then((response) => response.ok ? response.json() : { documents: [] }),
    ]).then(([auditData, documentData]) => {
      if (cancelled) return;
      setActivityItems(auditData.events.map((event: Record<string, unknown>, index: number) => {
        const action = String(event.action ?? "Registry activity");
        const actionLabels: Record<string, string> = {
          "record.created": "Record created",
          "record.updated": "Record updated",
          "document.upload_completed": "Document uploaded",
          "document.download_link_created": "Document opened",
          "auth.sign_in_succeeded": "Administrator signed in",
          "auth.sign_in_failed": "Sign-in attempt rejected",
        };
        const date = new Date(String(event.created_at));
        return {
          id: `${String(event.created_at)}-${index}`,
          initials: String(event.actor_name ?? "RG").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join(""),
          action: actionLabels[action] ?? action.replaceAll(".", " "),
          target: String(event.actor_name ?? event.entity_type ?? "Registry"),
          time: date.toLocaleString(),
          tone: ["mint", "peach", "blue", "yellow"][index % 4],
        };
      }));
      setDocumentList(documentData.documents);
    }).catch(() => { if (!cancelled) setPageError("Could not load recent registry activity."); });
    return () => { cancelled = true; };
  }, [sessionState, refreshKey]);

  useEffect(() => {
    if (sessionState !== "ready" || activeView !== "documents") return;
    fetch("/api/documents?limit=50", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : { documents: [] })
      .then((data) => setDocumentList(data.documents));
  }, [sessionState, activeView, refreshKey]);

  useEffect(() => {
    if (!selectedRecord) return;
    let cancelled = false;
    fetch(`/api/records/${selectedRecord.id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load record documents.");
        return response.json();
      })
      .then((data: { documents: RecordDocument[] }) => { if (!cancelled) setDocuments(data.documents); })
      .catch(() => { if (!cancelled) setDocuments([]); });
    return () => { cancelled = true; };
  }, [selectedRecord]);

  function openView(view: AppView) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function openDistrict(district: string) {
    setSelectedDistrict(district);
    setPageOffset(0);
    openView("records");
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const titleReference = String(form.get("titleReference") ?? "").trim();
    const district = String(form.get("district") ?? "").trim();
    if (!fullName || !titleReference || !district) return;

    const landSizeText = String(form.get("landSize") ?? "").trim();
    const payload = {
      person: {
        fullName,
        otherNames: String(form.get("otherNames") ?? "").trim() || editingRecord?.otherNames || "",
        contactPhone: String(form.get("contactPhone") ?? "").trim(),
      },
      parcel: {
        titleReference,
        district,
        region: String(form.get("region") ?? "").trim() || editingRecord?.region || "",
        county: String(form.get("county") ?? "").trim(),
        subCounty: String(form.get("subCounty") ?? "").trim(),
        parish: String(form.get("parish") ?? "").trim(),
        village: String(form.get("village") ?? "").trim(),
        landSize: landSizeText ? Number(landSizeText) : editingRecord?.landSizeValue ? Number(editingRecord.landSizeValue) : null,
        landSizeUnit: String(form.get("landSizeUnit") ?? editingRecord?.landSizeUnit ?? "unknown"),
        sourceBook: String(form.get("sourceBook") ?? "").trim() || editingRecord?.sourceBook || "",
        sourcePage: String(form.get("sourcePage") ?? "").trim() || editingRecord?.sourcePage || "",
        ...(editingRecord ? { verificationStatus: String(form.get("verificationStatus") ?? "needs_review") } : {}),
      },
    };

    setFormBusy(true);
    setFormError("");
    try {
      const response = await fetch(editingRecord ? `/api/records/${editingRecord.id}` : "/api/records", {
        method: editingRecord ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this record.");
      setShowAddForm(false);
      setEditingRecord(null);
      setSelectedDistrict("All districts");
      setSearch("");
      setPageOffset(0);
      setActiveView("records");
      setRefreshKey((current) => current + 1);
      const [districtResponse, summaryResponse] = await Promise.all([fetch("/api/districts"), fetch("/api/summary")]);
      if (districtResponse.ok) setDistricts((await districtResponse.json()).districts);
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this record.");
    } finally {
      setFormBusy(false);
    }
  }

  async function uploadFile(file: File | undefined, category: "person_photo" | "title_scan") {
    if (!file || !selectedRecord) return;
    setUploadBusy(true);
    setUploadError("");
    try {
      const request = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: category === "person_photo" ? selectedRecord.personId : undefined,
          parcelId: category === "title_scan" ? selectedRecord.id : undefined,
          category,
          filename: file.name,
          contentType: file.type,
          byteSize: file.size,
        }),
      });
      const upload = await request.json();
      if (!request.ok) throw new Error(upload.error ?? "Could not prepare this upload.");
      const putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putResponse.ok) throw new Error("File upload failed. Check the private storage service and try again.");
      const complete = await fetch(`/api/uploads/${upload.documentId}/complete`, { method: "POST" });
      if (!complete.ok) {
        const failure = await complete.json();
        throw new Error(failure.error ?? "The uploaded file could not be verified.");
      }
      const details = await fetch(`/api/records/${selectedRecord.id}`, { cache: "no-store" });
      if (details.ok) setDocuments((await details.json()).documents);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload this file.");
    } finally {
      setUploadBusy(false);
      if (photoInput.current) photoInput.current.value = "";
      if (scanInput.current) scanInput.current.value = "";
    }
  }

  async function openDocument(documentId: string) {
    const response = await fetch(`/api/uploads/${documentId}/download`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setUploadError(data.error ?? "Could not open the document.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/login");
  }

  if (sessionState === "loading" || sessionState === "signed-out") {
    return <main className="auth-state"><Building2 size={24} /><strong>Groundwork</strong><span>Checking secure administrator access…</span></main>;
  }
  if (sessionState === "unconfigured") {
    return <main className="auth-state"><Building2 size={24} /><strong>Registry setup needed</strong><span>Configure PostgreSQL and apply the setup steps in the project README before administrator sign-in.</span></main>;
  }

  return (
    <main className="app-shell">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#registry" onClick={() => openView("records")}>
          <span className="brand-mark"><Building2 size={20} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>Groundwork</strong><small>LAND REGISTRY</small></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">UG</span>
          <span className="workspace-copy"><strong>Uganda registry</strong><small>All districts</small></span>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeView === "records" ? "nav-item-active" : ""}`} onClick={() => openView("records")}>
            <BookOpen size={17} /><span>Registry</span><span className="nav-count">{summary.people_count}</span>
          </button>
          <button className={`nav-item ${activeView === "districts" ? "nav-item-active" : ""}`} onClick={() => openView("districts")}>
            <MapPin size={17} /><span>Districts</span>
          </button>
          <button className={`nav-item ${activeView === "documents" ? "nav-item-active" : ""}`} onClick={() => openView("documents")}>
            <FolderOpen size={17} /><span>Documents</span><span className="nav-count">{summary.document_count}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="security-note"><ShieldCheck size={16} /><span><strong>Administrator access</strong><small>Activity is audited</small></span></div>
          <div className="profile-row">
            <span className="profile-avatar">AN</span>
            <span className="profile-copy"><strong>{adminName}</strong><small>Registry administrator</small></span>
              <button className="icon-button sidebar-signout" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="crumb"><span>Uganda</span><ChevronRight size={14} /><strong>{viewLabels[activeView].title}</strong></div>
          <div className="topbar-actions">
            <span className="demo-indicator"><span /> SECURE REGISTRY</span>
            <button className="icon-button notification-button" aria-label="Security alerts" title="Security email alerts require SMTP configuration"><Bell size={18} /></button>
            <button className="profile-mini" aria-label="Sign out" onClick={signOut}>{adminName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</button>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span>REGISTRY OVERVIEW</span><span className="eyebrow-line" /></div>
              <h1>{viewLabels[activeView].title}<span className="heading-period">.</span></h1>
              <p>{viewLabels[activeView].subtitle}</p>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={() => window.print()}><Printer size={16} /> Print view</button>
              <button className="button button-primary" onClick={() => { setEditingRecord(null); setFormError(""); setShowAddForm(true); }}><Plus size={17} /> Add record</button>
            </div>
          </div>

          <div className="marquee-panel" aria-label="Registry status ticker">
            <div className="marquee-track">
              <span>UGANDA LAND REGISTRY • DEMO PRESENTATION • 500 RECORDS • DISTRICT READY • VERIFIED SOURCES • AUDITED ACCESS</span>
              <span>UGANDA LAND REGISTRY • DEMO PRESENTATION • 500 RECORDS • DISTRICT READY • VERIFIED SOURCES • AUDITED ACCESS</span>
            </div>
          </div>

          {pageError && <div className="demo-notice"><span className="demo-notice-icon"><CircleAlert size={16} /></span><p><strong>Registry service</strong><span>{pageError}</span></p><button aria-label="Dismiss message" onClick={() => setPageError("")}><X size={16} /></button></div>}

          {activeView === "records" && (
            <>
              <section className="metric-grid" aria-label="Registry summary">
                <article className="metric metric-green"><div className="metric-top"><span>People registered</span><BookOpen size={17} /></div><div className="metric-value">{summary.people_count}<span className="metric-unit">people</span></div><div className="metric-foot"><span className="metric-dot dot-green" /> Saved in registry</div></article>
                <article className="metric metric-white"><div className="metric-top"><span>Verified sources</span><BadgeCheck size={17} /></div><div className="metric-value">{verifiedCount}<span className="metric-unit">of {summary.parcel_count}</span></div><div className="metric-foot"><span className="metric-dot dot-green" /> Source checked against book</div></article>
                <article className="metric metric-white"><div className="metric-top"><span>Needs attention</span><CircleAlert size={17} /></div><div className="metric-value">{reviewCount}<span className="metric-unit">to review</span></div><div className="metric-foot"><span className="metric-dot dot-amber" /> Scan or details incomplete</div></article>
                <article className="metric metric-white"><div className="metric-top"><span>District coverage</span><MapPin size={17} /></div><div className="metric-value">{summary.district_count}<span className="metric-unit">districts</span></div><div className="metric-foot"><span className="metric-dot dot-blue" /> Across registry</div></article>
              </section>

              <section className="registry-section">
                <div className="section-heading">
                  <div><h2>People &amp; parcels</h2><p>Search by name, title reference, record ID, or village.</p></div>
                  <button className="text-button" onClick={() => { setSearch(""); setSelectedDistrict("All districts"); setSelectedStatus(""); setPageOffset(0); }}>Clear filters <ArrowUpRight size={14} /></button>
                </div>
                <div className="table-toolbar">
                  <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the registry..." aria-label="Search the registry" /><kbd>⌘ K</kbd></label>
                  <label className="district-select"><MapPin size={15} /><select aria-label="Filter by district" value={selectedDistrict} onChange={(event) => { setSelectedDistrict(event.target.value); setPageOffset(0); }}><option>All districts</option>{districts.map((district) => <option key={district.district}>{district.district}</option>)}</select><ChevronDown size={14} /></label>
                  <button className={`icon-button filter-button ${showFilters ? "filter-active" : ""}`} aria-label="Toggle additional filters" onClick={() => setShowFilters((current) => !current)}><SlidersHorizontal size={17} /><span>Filters</span></button>
                </div>
                {showFilters && <div className="filter-row"><Filter size={15} /><span>Source status</span><button className="filter-chip" onClick={() => { setSelectedStatus("needs_review"); setPageOffset(0); }}>Needs review</button><button className="filter-chip" onClick={() => { setSelectedStatus("scan_pending"); setPageOffset(0); }}>Scan pending</button><button className="filter-chip" onClick={() => { setSelectedStatus(""); setPageOffset(0); }}>All statuses</button></div>}
                <div className="table-frame">
                  <table className="records-table">
                    <thead><tr><th>PERSON / RECORD</th><th>LOCATION</th><th>LAND SIZE</th><th>SOURCE CHECK</th><th>LAST UPDATED</th><th aria-label="Actions" /></tr></thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id}>
                          <td><button className="person-cell" onClick={() => { setDocuments([]); setSelectedRecord(record); }}><Initials value={record.initials} tint={record.tint} /><span className="person-copy"><strong>{record.name}</strong><small>{record.recordNumber} <i /> {record.titleRef}</small></span></button></td>
                          <td><span className="location-cell"><strong>{record.district}</strong><small>{record.village}, {record.subCounty}</small></span></td>
                          <td><span className="land-size">{record.landSize}</span></td>
                          <td><StatusBadge status={record.status} /></td>
                          <td><span className="updated-cell">{record.updated}</span></td>
                          <td><button className="row-action" aria-label={`Open ${record.name} record`} onClick={() => { setDocuments([]); setSelectedRecord(record); }}><ChevronRight size={17} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRecords.length === 0 && <div className="empty-state">{loadingRecords ? <LoaderCircle size={22} className="spin-icon" /> : <Search size={22} />}<strong>{loadingRecords ? "Searching registry" : "No matching records"}</strong><span>{loadingRecords ? "Loading verified records from the database." : "Try a different name, title reference, or district."}</span></div>}
                </div>
                <div className="table-footer"><span>Showing <strong>{records.length}</strong> of <strong>{totalMatches}</strong> matching records</span><span className="table-footer-note"><ShieldCheck size={14} /> Every source should be checked against the original book</span></div>
                <div className="pagination"><button className="button button-secondary" disabled={pageOffset === 0 || loadingRecords} onClick={() => setPageOffset((current) => Math.max(0, current - 25))}>Previous</button><span>{totalMatches === 0 ? "No results" : `${pageOffset + 1}–${Math.min(pageOffset + records.length, totalMatches)} of ${totalMatches}`}</span><button className="button button-secondary" disabled={pageOffset + records.length >= totalMatches || loadingRecords} onClick={() => setPageOffset((current) => current + 25)}>Next</button></div>
              </section>

              <section className="lower-grid">
                <div className="activity-panel"><div className="panel-heading"><div><span className="panel-kicker">WORKSPACE PULSE</span><h2>Recent activity</h2></div><button className="icon-button" aria-label="Refresh activity" onClick={() => setRefreshKey((current) => current + 1)}><ChevronDown size={17} /></button></div><div className="activity-list">{activityItems.map((item) => <div className="activity-item" key={item.id}><Initials value={item.initials} tint={item.tone} /><span className="activity-copy"><strong>{item.action}</strong><small>By <b>{item.target}</b></small></span><time>{item.time}</time></div>)}{activityItems.length === 0 && <div className="activity-empty">No recorded activity yet.</div>}</div><button className="activity-link" onClick={() => openView("documents")}>Review source documents <ArrowUpRight size={14} /></button></div>
                <div className="review-callout"><div className="callout-icon"><FileImage size={19} /></div><span className="panel-kicker">SOURCE FIRST</span><h2>Keep the book in the loop.</h2><p>Every digital record should point back to its original book and page. Verify names, title references, and location before marking a scan complete.</p><button className="callout-link" onClick={() => openView("documents")}>Open document queue <ArrowUpRight size={15} /></button><div className="callout-stamp">01 <span>FIELD NOTE</span></div></div>
              </section>
            </>
          )}

          {activeView === "districts" && (
            <section className="districts-view">
              <div className="section-heading"><div><h2>Browse by district</h2><p>Choose a district to filter its people and parcel records.</p></div><span className="district-total">{districts.length} DISTRICTS</span></div>
              <div className="district-grid">{districts.map((district, index) => <button className="district-card" key={district.district} onClick={() => openDistrict(district.district)}><span className={`district-marker district-marker-${index % 4}`}><MapPin size={18} /></span><span className="district-card-main"><strong>{district.district}</strong><small>{district.parcel_count} {district.parcel_count === 1 ? "parcel" : "parcels"}</small></span><span className="district-arrow"><ArrowUpRight size={16} /></span><span className="district-card-note">Open registry</span></button>)}</div>
              <div className="district-footnote"><ShieldCheck size={16} /><span>All five administrators have access to every district. Changes are recorded in the audit history.</span></div>
            </section>
          )}

          {activeView === "documents" && (
            <section className="documents-view">
              <div className="section-heading"><div><h2>Book references &amp; scans</h2><p>Review source references and open a parcel to upload its book scan.</p></div><span className="district-total">{summary.document_count} FILES</span></div>
              <div className="document-list">{documentList.map((document) => <article className="document-row" key={document.id}>{document.category === "person_photo" && document.upload_status === "available" ? <Image className="document-thumb" src={`/api/uploads/${document.id}/download?redirect=1`} alt={`Photo of ${document.full_name ?? "landholder"}`} width={38} height={38} unoptimized /> : <span className="document-icon"><FileText size={19} /></span>}<div className="document-main"><strong>{document.original_filename}</strong><small>{document.record_number ?? "Person"} <i /> {document.title_reference ?? document.category} <i /> {document.district ?? ""}</small></div><span className={`status-badge ${document.upload_status === "available" ? "status-verified" : "status-scan-pending"}`}>{document.upload_status === "available" ? "Available" : "Pending"}</span>{document.upload_status === "available" && <button className="document-open" onClick={() => void openDocument(document.id)}>Open file <ChevronRight size={15} /></button>}</article>)}{documentList.length === 0 && <div className="empty-state"><FolderOpen size={22} /><strong>No files attached</strong><span>Open a registry record to add a person photo or title scan.</span></div>}</div>
              <div className="document-note"><CircleAlert size={17} /><div><strong>Verify each scan against its paper-book source.</strong><span>Files are private and can only be opened through a signed, short-lived link after administrator authentication.</span></div></div>
            </section>
          )}

          <footer className="app-footer"><span>GROUNDWORK <i /> UGANDA LAND REGISTRY</span><span>PROTOTYPE · FICTIONAL DATA ONLY</span></footer>
        </div>
      </section>

      {showAddForm && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowAddForm(false); setEditingRecord(null); } }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-record-title"><div className="modal-header"><div><span className="panel-kicker">{editingRecord ? "UPDATE REGISTRY ENTRY" : "NEW REGISTRY ENTRY"}</span><h2 id="add-record-title">{editingRecord ? "Edit land record" : "Add a registry record"}</h2><p>Enter only details supported by the source documents.</p></div><button className="icon-button" aria-label="Close form" onClick={() => { setShowAddForm(false); setEditingRecord(null); }}><X size={18} /></button></div><form className="record-form" onSubmit={addRecord}><div className="form-grid"><label className="form-field form-span"><span>Full legal name *</span><input name="fullName" required maxLength={180} defaultValue={editingRecord?.name} placeholder="Full name as written in the source" autoFocus /></label><label className="form-field"><span>Other names</span><input name="otherNames" maxLength={180} defaultValue="" placeholder="If recorded" /></label><label className="form-field"><span>Contact phone</span><input name="contactPhone" maxLength={40} defaultValue={editingRecord?.contact === "Not entered" ? "" : editingRecord?.contact} placeholder="If available and necessary" /></label><label className="form-field"><span>Title / deed reference *</span><input name="titleReference" required maxLength={120} defaultValue={editingRecord?.titleRef} placeholder="Reference from the source" /></label><label className="form-field"><span>District *</span><input name="district" required maxLength={100} defaultValue={editingRecord?.district} placeholder="District" /></label><label className="form-field"><span>Region</span><input name="region" maxLength={100} placeholder="Region" /></label><label className="form-field"><span>County</span><input name="county" maxLength={100} defaultValue={editingRecord?.county === "Not entered" ? "" : editingRecord?.county} placeholder="County" /></label><label className="form-field"><span>Sub-county</span><input name="subCounty" maxLength={100} defaultValue={editingRecord?.subCounty === "Not entered" ? "" : editingRecord?.subCounty} placeholder="Sub-county" /></label><label className="form-field"><span>Parish</span><input name="parish" maxLength={100} defaultValue={editingRecord?.parish === "Not entered" ? "" : editingRecord?.parish} placeholder="Parish" /></label><label className="form-field"><span>Village</span><input name="village" maxLength={120} defaultValue={editingRecord?.village === "Not entered" ? "" : editingRecord?.village} placeholder="Village" /></label><label className="form-field"><span>Land size</span><input name="landSize" type="number" min="0.0001" step="0.0001" defaultValue={editingRecord ? Number.parseFloat(editingRecord.landSize) || "" : ""} placeholder="If recorded" /></label><label className="form-field"><span>Unit</span><select name="landSizeUnit" defaultValue={editingRecord ? (editingRecord.landSize.includes("hectares") ? "hectares" : editingRecord.landSize.includes("square_metres") ? "square_metres" : "acres") : "unknown"}><option value="unknown">Not specified</option><option value="acres">Acres</option><option value="hectares">Hectares</option><option value="square_metres">Square metres</option></select></label><label className="form-field"><span>Source book</span><input name="sourceBook" maxLength={120} defaultValue={editingRecord?.source.split(" · ")[0]?.replace(/^Book /, "")} placeholder="Book number" /></label><label className="form-field"><span>Source page</span><input name="sourcePage" maxLength={40} defaultValue={editingRecord?.source.split(" · ")[1]?.replace(/^Page /, "")} placeholder="Page reference" /></label>{editingRecord && <label className="form-field"><span>Source check status</span><select name="verificationStatus" defaultValue={editingRecord.status === "Verified" ? "verified" : editingRecord.status === "Scan pending" ? "scan_pending" : "needs_review"}><option value="needs_review">Needs review</option><option value="scan_pending">Scan pending</option><option value="verified">Verified</option></select></label>}</div>{formError && <div className="login-error" role="alert">{formError}</div>}<div className="form-source-note"><ShieldCheck size={17} /><span><strong>Every change is attributed to your administrator account.</strong> Upload source scans from the record details after saving.</span></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => { setShowAddForm(false); setEditingRecord(null); }}>Cancel</button><button type="submit" className="button button-primary" disabled={formBusy}>{formBusy ? <LoaderCircle size={15} className="spin-icon" /> : editingRecord ? <FileUp size={16} /> : <Plus size={16} />}{formBusy ? "Saving..." : editingRecord ? "Save changes" : "Add record"}</button></div></form></section></div>}

      {selectedRecord && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecord(null); }}><section className="detail-card" role="dialog" aria-modal="true" aria-labelledby="record-detail-name"><div className="detail-topline"><button className="back-button" onClick={() => setSelectedRecord(null)}><ArrowLeft size={15} /> Registry</button><div className="detail-actions"><button className="button button-secondary" onClick={() => { setEditingRecord(selectedRecord); setFormError(""); setShowAddForm(true); setSelectedRecord(null); }}><FileUp size={15} /> Edit</button><button className="icon-button" aria-label="Close details" onClick={() => setSelectedRecord(null)}><X size={18} /></button></div></div><div className="detail-person"><Initials value={selectedRecord.initials} tint={selectedRecord.tint} /><div><span className="panel-kicker">{selectedRecord.recordNumber}</span><h2 id="record-detail-name">{selectedRecord.name}</h2><span className="detail-subtitle">Landholder record</span></div></div><div className="detail-status"><StatusBadge status={selectedRecord.status} /><span>Updated {selectedRecord.updated}</span></div><div className="detail-section-title">LAND &amp; LOCATION</div><dl className="detail-grid"><div><dt>Title reference</dt><dd>{selectedRecord.titleRef}</dd></div><div><dt>Recorded area</dt><dd>{selectedRecord.landSize}</dd></div><div><dt>District</dt><dd>{selectedRecord.district}</dd></div><div><dt>County</dt><dd>{selectedRecord.county}</dd></div><div><dt>Sub-county</dt><dd>{selectedRecord.subCounty}</dd></div><div><dt>Parish</dt><dd>{selectedRecord.parish}</dd></div><div><dt>Village</dt><dd>{selectedRecord.village}</dd></div><div><dt>Contact</dt><dd>{selectedRecord.contact}</dd></div></dl><div className="detail-section-title">PERSON PHOTO &amp; SOURCE FILES</div><div className="upload-actions"><input ref={photoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadFile(event.currentTarget.files?.[0], "person_photo")} /><input ref={scanInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void uploadFile(event.currentTarget.files?.[0], "title_scan")} /><button className="button button-secondary" disabled={uploadBusy} onClick={() => photoInput.current?.click()}><ImagePlus size={15} /> Add person photo</button><button className="button button-secondary" disabled={uploadBusy} onClick={() => scanInput.current?.click()}><FileUp size={15} /> Upload title scan</button>{uploadBusy && <LoaderCircle size={16} className="spin-icon" />}</div>{uploadError && <div className="login-error upload-error" role="alert">{uploadError}</div>}<div className="detail-files">{documents.map((document) => <div className="detail-file" key={document.id}>{document.category === "person_photo" && document.content_type.startsWith("image/") && document.upload_status === "available" ? <Image className="detail-file-photo" src={`/api/uploads/${document.id}/download?redirect=1`} alt={`Photo of ${selectedRecord.name}`} width={42} height={42} unoptimized /> : <span className="document-icon"><FileText size={18} /></span>}<span className="detail-file-copy"><strong>{document.original_filename}</strong><small>{document.category === "person_photo" ? "Person photo" : "Land title source"} · {document.upload_status === "available" ? `${Math.ceil(document.byte_size / 1024)} KB` : "Upload pending"}</small></span>{document.upload_status === "available" && <button className="document-open" onClick={() => void openDocument(document.id)}>Open <ArrowUpRight size={14} /></button>}</div>)}{documents.length === 0 && <div className="empty-files"><FileImage size={17} /><span>No files attached yet</span></div>}</div><div className="detail-notice"><ShieldCheck size={16} /><span>Files are private. Access is checked and recorded each time a document is opened.</span></div></section></div>}
    </main>
  );
}
