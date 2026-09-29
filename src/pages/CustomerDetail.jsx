import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Edit,
  Trash2,
  Calendar,
  User,
  Building2,
  Activity,
  FileText,
  Clock,
  FlaskConical,
  Scale,
  Ruler
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import SetupBanner from "../components/SetupBanner.jsx";
import { useToast } from "../components/Toast.jsx";
import { supabase, friendlyError, isSupabaseConfigured } from "../supabaseClient.js";

const HIGHLIGHT_CARE_SEPARATOR = " | Highlight Care ";

function extractVisitType(r) {
  if (r?.visit_type) return r.visit_type;
  if (r?.rest) {
    if (r.rest.includes("[Visit: Home Visit]")) return "Home Visit";
    if (r.rest.includes("[Visit: Center Visit]")) return "Center Visit";
  }
  return "Center Visit";
}

function extractCleanReport(rawRest) {
  return (rawRest || "").replace(/\s*\[Visit:\s*(Home Visit|Center Visit)\]/gi, "").trim();
}

function calculateBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) return null;
  const hMeters = h / 100;
  const bmi = (w / (hMeters * hMeters)).toFixed(1);
  let category = "Normal";
  let color = "#1F8A55";
  let bg = "#E7F6ED";
  if (bmi < 18.5) {
    category = "Underweight";
    color = "#D98A3D";
    bg = "#FFF7EC";
  } else if (bmi >= 25 && bmi < 30) {
    category = "Overweight";
    color = "#D98A3D";
    bg = "#FFF7EC";
  } else if (bmi >= 30) {
    category = "Obese";
    color = "#C0392B";
    bg = "#FBEAE8";
  }
  return { val: bmi, category, color, bg };
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastEl } = useToast();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchRecord = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("employee_records")
      .select("*, companies(name)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setErrorMsg(friendlyError(error));
      setLoading(false);
      return;
    }

    if (!data) {
      setErrorMsg("Yeh customer record nahi mila ya delete ho chuka hai.");
      setLoading(false);
      return;
    }

    setRecord(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("employee_records").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      showToast(friendlyError(error), true);
      return;
    }
    showToast("Record delete ho gaya.");
    setTimeout(() => {
      navigate("/employees");
    }, 600);
  }

  const visitType = record ? extractVisitType(record) : "Center Visit";
  const reportNotes = record ? extractCleanReport(record.rest) : "";
  const bmiInfo = record ? calculateBMI(record.height, record.weight) : null;

  // TPA and Highlight Care formatting
  let tpaDisplay = "-";
  let highlightCareDisplay = null;
  if (record?.tpa) {
    const [tpaName, hc] = record.tpa.split(HIGHLIGHT_CARE_SEPARATOR);
    tpaDisplay = tpaName || record.tpa;
    if (hc) {
      highlightCareDisplay = `Highlight Care ${hc}`;
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <SetupBanner errorMessage={errorMsg} />

        {/* Top Navigation & Action Controls */}
        <div className="detail-header-actions no-print">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/employees")}>
            <ArrowLeft size={16} /> Back to Customer Records
          </button>
          {record && (
            <div className="detail-action-buttons">
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                <Printer size={15} /> Print Record
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/employees?edit=${record.id}`)}
              >
                <Edit size={15} /> Edit Record
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="card">
            <div className="empty-state">Loading customer record details...</div>
          </div>
        ) : !record ? (
          <div className="card">
            <div className="empty-state" style={{ color: "var(--danger)" }}>
              {errorMsg || "Record not found"}
              <div style={{ marginTop: "1rem" }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/employees")}>
                  Return to Records
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="customer-detail-page">
            {/* Printable Lab Slip Header - ONLY shown on print */}
            <div className="print-only print-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0E6E5C", paddingBottom: "12px", marginBottom: "18px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "20pt", color: "#0E6E5C", fontWeight: 700 }}>Lab Management System</h1>
                  <div style={{ fontSize: "10pt", color: "#555", marginTop: "3px" }}>Customer Medical & Physical Health Record</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "9pt", color: "#666" }}>
                  <div><strong>Print Date:</strong> {new Date().toLocaleDateString()}</div>
                  <div><strong>Record ID:</strong> {record.id.slice(0, 8)}</div>
                </div>
              </div>
            </div>

            {/* Profile Overview Banner */}
            <div className="card detail-overview-card">
              <div className="detail-profile-row">
                <div className="detail-avatar">
                  <User size={34} strokeWidth={2.2} />
                </div>
                <div className="detail-profile-info">
                  <div className="detail-title-line">
                    <h2 className="detail-name">{record.full_name}</h2>
                    <span className={`badge ${visitType === "Home Visit" ? "badge-home" : "badge-center"}`}>
                      {visitType === "Home Visit" ? "🏠 Home Visit" : "🏥 Center Visit"}
                    </span>
                  </div>
                  <div className="detail-quick-tags">
                    <span className="tag-item"><Calendar size={13} /> {record.record_date}</span>
                    <span className="tag-item">Gender: <strong>{record.gender || "Not specified"}</strong></span>
                    <span className="tag-item">Age: <strong>{record.age} yrs</strong></span>
                    <span className="tag-item"><Building2 size={13} /> {record.companies?.name || "No Company"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-grid">
              {/* Card 1: General & Registration Details */}
              <div className="card">
                <h3 className="section-title">
                  <User size={18} /> Customer Registration Details
                </h3>
                <div className="info-kv-grid">
                  <div className="info-kv">
                    <span className="info-key">Full Name</span>
                    <span className="info-val strong">{record.full_name}</span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Record Date</span>
                    <span className="info-val">{record.record_date}</span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Gender</span>
                    <span className="info-val">{record.gender || "-"}</span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Age</span>
                    <span className="info-val">{record.age != null ? `${record.age} Years` : "-"}</span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Company Name</span>
                    <span className="info-val strong" style={{ color: "var(--primary-dark)" }}>
                      {record.companies?.name || "-"}
                    </span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">TPA</span>
                    <span className="info-val">
                      {tpaDisplay}
                      {highlightCareDisplay && (
                        <span className="badge" style={{ marginLeft: "6px", background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                          {highlightCareDisplay}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Service Type</span>
                    <span className="info-val">{record.service_type || "-"}</span>
                  </div>
                  <div className="info-kv">
                    <span className="info-key">Visit Type</span>
                    <span className="info-val">
                      <span className={`badge ${visitType === "Home Visit" ? "badge-home" : "badge-center"}`}>
                        {visitType === "Home Visit" ? "🏠 Home Visit (Home se)" : "🏥 Center Visit (Enter visit)"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Physical & Body Measurements */}
              <div className="card">
                <h3 className="section-title">
                  <Activity size={18} /> Physical & Body Measurements
                </h3>
                <div className="measurements-grid">
                  <div className="measure-box">
                    <div className="measure-label"><Ruler size={13} /> Height</div>
                    <div className="measure-value">
                      {record.height != null && record.height !== "" ? `${record.height} cm` : "-"}
                    </div>
                  </div>
                  <div className="measure-box">
                    <div className="measure-label"><Scale size={13} /> Weight</div>
                    <div className="measure-value">
                      {record.weight != null && record.weight !== "" ? `${record.weight} kg` : "-"}
                    </div>
                  </div>
                  {bmiInfo && (
                    <div className="measure-box" style={{ background: bmiInfo.bg }}>
                      <div className="measure-label" style={{ color: bmiInfo.color }}>Calculated BMI</div>
                      <div className="measure-value" style={{ color: bmiInfo.color }}>
                        {bmiInfo.val} <span style={{ fontSize: "0.72rem" }}>({bmiInfo.category})</span>
                      </div>
                    </div>
                  )}
                  <div className="measure-box">
                    <div className="measure-label">Chest</div>
                    <div className="measure-value">
                      {record.chest != null && record.chest !== "" ? record.chest : "-"}
                    </div>
                  </div>
                  <div className="measure-box">
                    <div className="measure-label">Abdomen</div>
                    <div className="measure-value">
                      {record.abdomen != null && record.abdomen !== "" ? record.abdomen : "-"}
                    </div>
                  </div>
                  <div className="measure-box">
                    <div className="measure-label">Waist</div>
                    <div className="measure-value">
                      {record.waist != null && record.waist !== "" ? record.waist : "-"}
                    </div>
                  </div>
                  <div className="measure-box">
                    <div className="measure-label">Hips</div>
                    <div className="measure-value">
                      {record.hips != null && record.hips !== "" ? record.hips : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Report Notes (formerly Rest) */}
            <div className="card">
              <h3 className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={18} /> Report
                </span>
                <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--muted)" }}>
                  Medical & Checkup Notes
                </span>
              </h3>
              <div className="report-content-box">
                {reportNotes ? (
                  <p className="report-text">{reportNotes}</p>
                ) : (
                  <div className="empty-report-text">
                    Koi report notes enter nahi kiye gaye hain.
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Audit & Record Meta */}
            <div className="card no-print" style={{ background: "var(--surface-sunk)", borderColor: "var(--border)" }}>
              <div className="meta-row">
                <span className="meta-item"><Clock size={13} /> <strong>Created:</strong> {new Date(record.created_at).toLocaleString()}</span>
                {record.updated_at && (
                  <span className="meta-item"><Clock size={13} /> <strong>Updated:</strong> {new Date(record.updated_at).toLocaleString()}</span>
                )}
                <span className="meta-item"><strong>Record ID:</strong> <code style={{ fontSize: "0.78rem" }}>{record.id}</code></span>
              </div>
            </div>

            {/* Printable Doctor / Technician Signature Section */}
            <div className="print-only print-signatures">
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px", padding: "0 20px" }}>
                <div style={{ textAlign: "center", width: "200px", borderTop: "1px solid #333", paddingTop: "6px", fontSize: "10pt" }}>
                  Patient / Customer Signature
                </div>
                <div style={{ textAlign: "center", width: "220px", borderTop: "1px solid #333", paddingTop: "6px", fontSize: "10pt" }}>
                  Authorized Lab Signatory & Seal
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop show no-print">
          <div className="modal">
            <h3 style={{ marginTop: 0 }}>Delete this customer record?</h3>
            <p style={{ color: "var(--muted)" }}>
              Kya aap sure hain ki aap <strong>{record?.full_name}</strong> ka record delete karna chahte hain? Yeh wapas nahi hoga.
            </p>
            <div className="actions-row">
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ToastEl}
    </>
  );
}
