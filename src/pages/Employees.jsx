import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Download, Printer, Save, X, Eye } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import SetupBanner from "../components/SetupBanner.jsx";
import { useToast } from "../components/Toast.jsx";
import { supabase, friendlyError, isSupabaseConfigured } from "../supabaseClient.js";

const SERVICE_TYPES = ["Pre-Employment Checkup", "Annual Health Checkup", "Insurance Medical Test", "Body Checkup", "OPD", "Other"];
const HIGHLIGHT_CARE_TATS = new Set(["Health India TPA", "Health India TAT", "Visit Health", "Ericson"]);
const HIGHLIGHT_CARE_SEPARATOR = " | Highlight Care ";
const PAGE_SIZE = 15;

function extractVisitType(r) {
  if (r?.visit_type) return r.visit_type;
  if (r?.rest) {
    if (r.rest.includes("[Visit: Home Visit]")) return "Home Visit";
    if (r.rest.includes("[Visit: Center Visit]")) return "Center Visit";
  }
  return "Center Visit";
}

function extractCleanRest(rawRest) {
  return (rawRest || "").replace(/\s*\[Visit:\s*(Home Visit|Center Visit)\]/gi, "").trim();
}

const emptyForm = {
  id: "", record_date: new Date().toISOString().slice(0, 10), full_name: "", gender: "",
  age: "", height: "", weight: "", chest: "", abdomen: "", waist: "", hips: "",
  rest: "", tpa: "", company_id: "", service_type: "",
  visit_type: "Center Visit",
};

export default function Employees() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, ToastEl } = useToast();

  const [companies, setCompanies] = useState([]);
  const [tatOptions, setTatOptions] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [tpaHighlightCare, setTpaHighlightCare] = useState("");
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasVisitTypeCol, setHasVisitTypeCol] = useState(true);

  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  const [filters, setFilters] = useState({
    search: params.get("search") || "",
    company: params.get("company") || "",
    tpa: "",
    date: "",
    service: "",
    visit: "",
    sort: "record_date-desc",
  });

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadCompanies();
      loadTatOptions();
      checkVisitTypeColumn();
    }
  }, []);

  async function checkVisitTypeColumn() {
    const { error } = await supabase.from("employee_records").select("visit_type").limit(1);
    if (error && (error.code === "42703" || error.message?.includes("visit_type"))) {
      setHasVisitTypeCol(false);
    } else {
      setHasVisitTypeCol(true);
    }
  }

  async function loadTatOptions() {
    const { data, error } = await supabase.from("tat_list").select("id,name").order("sort_order", { ascending: true });
    if (error) { setErrorMsg(friendlyError(error)); return; }
    setTatOptions(data || []);
  }

  async function loadCompanies() {
    const { data, error } = await supabase.from("companies").select("id,name").eq("is_active", true).order("name");
    if (error) { setErrorMsg(friendlyError(error)); return; }
    setCompanies(data || []);
  }

  function updateForm(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function validate() {
    if (!form.record_date) return "Date is required.";
    if (!form.full_name.trim()) return "Full name is required.";
    if (!form.gender) return "Gender is required.";
    if (form.age === "" || isNaN(Number(form.age))) return "Age is required.";
    if (!form.company_id) return "Company is required.";
    if (!form.service_type) return "Service type is required.";
    return null;
  }

  async function saveRecord(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError("");

    const storedTpa = HIGHLIGHT_CARE_TATS.has(form.tpa) && tpaHighlightCare
      ? `${form.tpa}${HIGHLIGHT_CARE_SEPARATOR}${tpaHighlightCare}`
      : form.tpa;

    const cleanRest = form.rest.trim();
    const fallbackRest = cleanRest
      ? `${cleanRest} [Visit: ${form.visit_type}]`
      : `[Visit: ${form.visit_type}]`;

    const payload = {
      record_date: form.record_date,
      full_name: form.full_name.trim(),
      gender: form.gender,
      age: Number(form.age),
      height: form.height === "" ? null : Number(form.height),
      weight: form.weight === "" ? null : Number(form.weight),
      chest: form.chest === "" ? null : Number(form.chest),
      abdomen: form.abdomen === "" ? null : Number(form.abdomen),
      waist: form.waist === "" ? null : Number(form.waist),
      hips: form.hips === "" ? null : Number(form.hips),
      rest: hasVisitTypeCol ? cleanRest : fallbackRest,
      tpa: storedTpa.trim(),
      company_id: form.company_id,
      service_type: form.service_type,
    };

    if (hasVisitTypeCol) {
      payload.visit_type = form.visit_type;
    }

    let result;
    if (editing) {
      result = await supabase.from("employee_records").update(payload).eq("id", form.id);
    } else {
      result = await supabase.from("employee_records").insert(payload);
    }

    // Fallback if column does not exist yet in Supabase table
    if (result.error && (result.error.code === "42703" || result.error.message?.includes("visit_type"))) {
      setHasVisitTypeCol(false);
      const fallbackPayload = {
        ...payload,
        rest: fallbackRest,
      };
      delete fallbackPayload.visit_type;

      if (editing) {
        result = await supabase.from("employee_records").update(fallbackPayload).eq("id", form.id);
      } else {
        result = await supabase.from("employee_records").insert(fallbackPayload);
      }
    }

    if (result.error) { setFormError(friendlyError(result.error)); return; }

    showToast(editing ? "Record update ho gaya." : "Record save ho gaya.");
    clearForm();
    loadRecords();
  }

  function clearForm() {
    setForm({ ...emptyForm, record_date: new Date().toISOString().slice(0, 10), visit_type: "Center Visit" });
    setTpaHighlightCare("");
    setEditing(false);
    setFormError("");
  }

  function startEdit(r) {
    const [tpaName, savedHighlightCare] = (r.tpa || "").split(HIGHLIGHT_CARE_SEPARATOR);
    const vType = extractVisitType(r);
    const cleanRest = extractCleanRest(r.rest);
    setForm({
      id: r.id, record_date: r.record_date, full_name: r.full_name, gender: r.gender || "",
      age: r.age ?? "", height: r.height ?? "", weight: r.weight ?? "", chest: r.chest ?? "",
      abdomen: r.abdomen ?? "", waist: r.waist ?? "", hips: r.hips ?? "", rest: cleanRest,
      tpa: tpaName || "", company_id: r.company_id || "", service_type: r.service_type || "",
      visit_type: vType,
    });
    setTpaHighlightCare(savedHighlightCare || "");
    setEditing(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const editId = params.get("edit");
  useEffect(() => {
    if (editId && isSupabaseConfigured) {
      supabase
        .from("employee_records")
        .select("*, companies(name)")
        .eq("id", editId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data && !error) {
            startEdit(data);
          }
        });
    }
  }, [editId]);

  const loadRecords = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoadingRecords(false); return; }
    setLoadingRecords(true);
    const [sortCol, sortDir] = filters.sort.split("-");
    let query = supabase.from("employee_records").select("*, companies(name)", { count: "exact" });
    if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
    if (filters.company) query = query.eq("company_id", filters.company);
    if (filters.tpa) query = query.ilike("tpa", `${filters.tpa}%`);
    if (filters.date) query = query.eq("record_date", filters.date);
    if (filters.service) query = query.eq("service_type", filters.service);
    if (filters.visit) {
      if (hasVisitTypeCol) {
        query = query.eq("visit_type", filters.visit);
      } else {
        query = query.ilike("rest", `%[Visit: ${filters.visit}]%`);
      }
    }
    query = query.order(sortCol, { ascending: sortDir === "asc" });

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) { setErrorMsg(friendlyError(error)); setLoadingRecords(false); return; }
    setRecords(data || []);
    setTotalRows(count || 0);
    setLoadingRecords(false);
  }, [filters, page, hasVisitTypeCol]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function confirmDelete() {
    const { error } = await supabase.from("employee_records").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) { showToast(friendlyError(error), true); return; }
    showToast("Record delete ho gaya.");
    loadRecords();
  }

  async function exportCSV() {
    const [sortCol, sortDir] = filters.sort.split("-");
    let query = supabase.from("employee_records").select("*, companies(name)");
    if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
    if (filters.company) query = query.eq("company_id", filters.company);
    if (filters.tpa) query = query.ilike("tpa", `${filters.tpa}%`);
    if (filters.date) query = query.eq("record_date", filters.date);
    if (filters.service) query = query.eq("service_type", filters.service);
    if (filters.visit) {
      if (hasVisitTypeCol) {
        query = query.eq("visit_type", filters.visit);
      } else {
        query = query.ilike("rest", `%[Visit: ${filters.visit}]%`);
      }
    }
    const { data, error } = await query.order(sortCol, { ascending: sortDir === "asc" });
    if (error) { showToast(friendlyError(error), true); return; }
    if (!data || data.length === 0) { showToast("Export karne ke liye koi record nahi hai.", true); return; }

    const headers = ["Date","Full Name","Gender","Age","Height","Weight","Chest","Abdomen","Waist","Hips","Report","TPA","Company","Service Type","Visit Type"];
    const rows = data.map((r) => [
      r.record_date, r.full_name, r.gender, r.age, r.height, r.weight, r.chest, r.abdomen,
      r.waist, r.hips, extractCleanRest(r.rest), r.tpa, r.companies?.name || "", r.service_type,
      extractVisitType(r),
    ]);
    let csv = headers.join(",") + "\n";
    rows.forEach((row) => { csv += row.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",") + "\n"; });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customer_records_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <>
      <Navbar />
      <div className="container">
        <SetupBanner errorMessage={errorMsg} />

        {!hasVisitTypeCol && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF", padding: "0.6rem 0.9rem", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "1rem" }}>
            ℹ️ <strong>Supabase Note:</strong> Visit Type (Home / Center) bina rukawat ke save ho raha hai. Iska alag column database mein add karne ke liye Supabase SQL Editor mein run karein:
            <code style={{ background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: "4px", marginLeft: "6px", display: "inline-block", marginTop: "3px" }}>
              ALTER TABLE public.employee_records ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'Center Visit';
            </code>
          </div>
        )}

        <div className="card no-print">
          <h3 style={{ marginTop: 0 }}>{editing ? "Edit Customer Record" : "Add Customer Record"}</h3>
          <form onSubmit={saveRecord}>
            <div className="form-grid">
              <div><label>Date *</label><input type="date" value={form.record_date} onChange={(e) => updateForm("record_date", e.target.value)} required /></div>
              <div><label>Full Name *</label><input type="text" value={form.full_name} onChange={(e) => updateForm("full_name", e.target.value)} required /></div>
              <div><label>Gender *</label>
                <select value={form.gender} onChange={(e) => updateForm("gender", e.target.value)} required>
                  <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div><label>Age *</label><input type="number" min="0" max="120" value={form.age} onChange={(e) => updateForm("age", e.target.value)} required /></div>
              <div><label>Height (cm)</label><input type="number" step="0.1" value={form.height} onChange={(e) => updateForm("height", e.target.value)} /></div>
              <div><label>Weight (kg)</label><input type="number" step="0.1" value={form.weight} onChange={(e) => updateForm("weight", e.target.value)} /></div>
              <div><label>Chest</label><input type="number" step="0.1" value={form.chest} onChange={(e) => updateForm("chest", e.target.value)} /></div>
              <div><label>Abdomen</label><input type="number" step="0.1" value={form.abdomen} onChange={(e) => updateForm("abdomen", e.target.value)} /></div>
              <div><label>Waist</label><input type="number" step="0.1" value={form.waist} onChange={(e) => updateForm("waist", e.target.value)} /></div>
              <div><label>Hips</label><input type="number" step="0.1" value={form.hips} onChange={(e) => updateForm("hips", e.target.value)} /></div>
              <div><label>Report</label><input type="text" placeholder="Enter report / medical findings" value={form.rest} onChange={(e) => updateForm("rest", e.target.value)} /></div>
              <div><label>TPA</label>
                <select value={form.tpa} onChange={(e) => { updateForm("tpa", e.target.value); setTpaHighlightCare(""); }}>
                  <option value="">Select TPA</option>
                  {tatOptions.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              {HIGHLIGHT_CARE_TATS.has(form.tpa) && <div>
                <label>Highlight Care</label>
                <select value={tpaHighlightCare} onChange={(e) => setTpaHighlightCare(e.target.value)} required>
                  <option value="">Select Highlight Care</option>
                  <option value="1">Highlight Care 1</option>
                  <option value="2">Highlight Care 2</option>
                </select>
              </div>}
              <div><label>Company Name *</label>
                <select value={form.company_id} onChange={(e) => updateForm("company_id", e.target.value)} required>
                  <option value="">Select company</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label>Service Type *</label>
                <select value={form.service_type} onChange={(e) => updateForm("service_type", e.target.value)} required>
                  <option value="">Select</option>
                  {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Visit Type (Home / Center Visit) *</label>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", minHeight: "42px", flexWrap: "wrap", marginBottom: "0.95rem" }}>
                  <label className={`visit-toggle-card ${form.visit_type === "Home Visit" ? "active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.visit_type === "Home Visit"}
                      onChange={(e) => updateForm("visit_type", e.target.checked ? "Home Visit" : "Center Visit")}
                    />
                    <span>🏠 Home Visit (Home se)</span>
                  </label>
                  <label className={`visit-toggle-card ${form.visit_type === "Center Visit" ? "active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.visit_type === "Center Visit"}
                      onChange={(e) => updateForm("visit_type", e.target.checked ? "Center Visit" : "Home Visit")}
                    />
                    <span>🏥 Center Visit (Enter visit)</span>
                  </label>
                </div>
              </div>
            </div>
            {formError && <div className="error-text show">{formError}</div>}
            <div className="actions-row">
              <button type="submit" className="btn btn-primary"><Save size={15} /> {editing ? "Update Record" : "Save Record"}</button>
              <button type="button" className="btn btn-secondary" onClick={clearForm}><X size={15} /> {editing ? "Cancel" : "Clear"}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>All Records</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.84rem", marginTop: "-0.4rem", marginBottom: "0.9rem" }}>
            💡 Kisi bhi customer record par <strong>Double Click</strong> karein uski saari details naye page par dekhne ke liye, ya <strong>View</strong> button dabayein.
          </p>
          <div className="actions-row no-print">
            <input type="text" placeholder="Search by name..." style={{ maxWidth: 200, marginBottom: 0 }}
              value={filters.search} onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }} />
            <select style={{ maxWidth: 200, marginBottom: 0 }} value={filters.company}
              onChange={(e) => { setFilters((f) => ({ ...f, company: e.target.value })); setPage(1); }}>
              <option value="">All Companies</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select style={{ maxWidth: 170, marginBottom: 0 }} value={filters.tpa}
              onChange={(e) => { setFilters((f) => ({ ...f, tpa: e.target.value })); setPage(1); }}>
              <option value="">All TPAs</option>
              {tatOptions.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select style={{ maxWidth: 160, marginBottom: 0 }} value={filters.visit}
              onChange={(e) => { setFilters((f) => ({ ...f, visit: e.target.value })); setPage(1); }}>
              <option value="">All Visit Types</option>
              <option value="Home Visit">🏠 Home Visit</option>
              <option value="Center Visit">🏥 Center Visit</option>
            </select>
            <input type="date" style={{ maxWidth: 160, marginBottom: 0 }} value={filters.date}
              onChange={(e) => { setFilters((f) => ({ ...f, date: e.target.value })); setPage(1); }} />
            <select style={{ maxWidth: 180, marginBottom: 0 }} value={filters.service}
              onChange={(e) => { setFilters((f) => ({ ...f, service: e.target.value })); setPage(1); }}>
              <option value="">All Service Types</option>
              {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select style={{ maxWidth: 160, marginBottom: 0 }} value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="record_date-desc">Date (newest)</option>
              <option value="record_date-asc">Date (oldest)</option>
              <option value="full_name-asc">Name (A-Z)</option>
              <option value="full_name-desc">Name (Z-A)</option>
            </select>
            <button className="btn btn-secondary" onClick={exportCSV}><Download size={15} /> Export CSV</button>
            <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Company</th>
                  <th>Service Type</th>
                  <th>Visit Type</th>
                  <th>TPA</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecords ? (
                  <tr><td colSpan={9} className="empty-state">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">Koi record nahi mila. Upar form se naya record add karein.</td></tr>
                ) : (
                  records.map((r) => {
                    const vType = extractVisitType(r);
                    return (
                      <tr
                        key={r.id}
                        className="clickable-row"
                        onDoubleClick={() => navigate(`/records/${r.id}`)}
                        title="Double-click to view complete customer details"
                      >
                        <td>{r.record_date}</td>
                        <td><strong>{r.full_name}</strong></td>
                        <td>{r.gender || "-"}</td>
                        <td>{r.age ?? "-"}</td>
                        <td>{r.companies?.name || "-"}</td>
                        <td>{r.service_type || "-"}</td>
                        <td>
                          <span className={`badge ${vType === "Home Visit" ? "badge-home" : "badge-center"}`}>
                            {vType === "Home Visit" ? "🏠 Home" : "🏥 Center"}
                          </span>
                        </td>
                        <td>{r.tpa || "-"}</td>
                        <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/records/${r.id}`)}
                            title="View all details"
                          >
                            <Eye size={13} /> View
                          </button>{" "}
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>
                            Edit
                          </button>{" "}
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(r.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination no-print">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {deleteId && (
        <div className="modal-backdrop show no-print">
          <div className="modal">
            <h3 style={{ marginTop: 0 }}>Delete this record?</h3>
            <p style={{ color: "var(--muted)" }}>Yeh wapas nahi hoga.</p>
            <div className="actions-row">
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {ToastEl}
    </>
  );
}
