import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, CalendarCheck2, CheckCircle2, Search, Plus, ClipboardList } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import SetupBanner from "../components/SetupBanner.jsx";
import { supabase, friendlyError, isSupabaseConfigured } from "../supabaseClient.js";

function extractVisitType(r) {
  if (r?.visit_type) return r.visit_type;
  if (r?.rest?.includes("[Visit: Home Visit]")) return "Home Visit";
  if (r?.rest?.includes("[Visit: Center Visit]")) return "Center Visit";
  return "Center Visit";
}

export default function Dashboard() {
  const [stats, setStats] = useState({ companies: 0, activeCompanies: 0, records: 0, today: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    loadStats();
    loadRecent();
  }, []);

  async function loadStats() {
    const { count: companies, error: e1 } = await supabase.from("companies").select("*", { count: "exact", head: true });
    if (e1) { setErrorMsg(friendlyError(e1)); return; }
    const { count: activeCompanies } = await supabase
      .from("companies").select("*", { count: "exact", head: true }).eq("is_active", true);
    const { count: records, error: e2 } = await supabase.from("employee_records").select("*", { count: "exact", head: true });
    if (e2) { setErrorMsg(friendlyError(e2)); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await supabase
      .from("employee_records").select("*", { count: "exact", head: true }).eq("record_date", today);
    setStats({ companies: companies || 0, activeCompanies: activeCompanies || 0, records: records || 0, today: todayCount || 0 });
  }

  async function loadRecent() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_records")
      .select("id, record_date, full_name, service_type, rest, created_at, companies(name)")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) { setErrorMsg(friendlyError(error)); setLoading(false); return; }
    setRecent(data || []);
    setLoading(false);
  }

  function quickSearch() {
    navigate(search ? `/employees?search=${encodeURIComponent(search)}` : "/employees");
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <SetupBanner errorMessage={errorMsg} />

        <div className="card">
          <div className="actions-row" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Search customer by name..."
              style={{ maxWidth: 320, marginBottom: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickSearch()}
            />
            <button className="btn btn-primary" onClick={quickSearch}><Search size={15} /> Search</button>
            <button className="btn btn-primary" onClick={() => navigate("/employees")}><Plus size={15} /> Quick Add Customer</button>
            <button className="btn btn-secondary" onClick={() => navigate("/companies")}><Plus size={15} /> Add New Company</button>
            <button className="btn btn-secondary" onClick={() => navigate("/tat-list")}><ClipboardList size={15} /> TAT List</button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="icon-wrap"><Building2 size={20} /></div>
            <div><div className="num">{stats.companies}</div><div className="label">Total Companies</div></div>
          </div>
          <div className="stat-card">
            <div className="icon-wrap"><Users size={20} /></div>
            <div><div className="num">{stats.records}</div><div className="label">Total Customer Records</div></div>
          </div>
          <div className="stat-card">
            <div className="icon-wrap"><CalendarCheck2 size={20} /></div>
            <div><div className="num">{stats.today}</div><div className="label">Today's Entries</div></div>
          </div>
          <div className="stat-card">
            <div className="icon-wrap"><CheckCircle2 size={20} /></div>
            <div><div className="num">{stats.activeCompanies}</div><div className="label">Active Companies</div></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent Records</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Name</th><th>Company</th><th>Service Type</th><th>Visit Type</th><th>Added</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="empty-state">Loading...</td></tr>
                ) : recent.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">Abhi koi record nahi hai. "Quick Add Customer" se pehla record add karein.</td></tr>
                ) : (
                  recent.map((r, i) => {
                    const vType = extractVisitType(r);
                    return (
                      <tr
                        key={r.id || i}
                        className="clickable-row"
                        onDoubleClick={() => r.id && navigate(`/records/${r.id}`)}
                        title="Double-click to view complete details"
                      >
                        <td>{r.record_date}</td>
                        <td><strong>{r.full_name}</strong></td>
                        <td>{r.companies?.name || "-"}</td>
                        <td>{r.service_type || "-"}</td>
                        <td>
                          <span className={`badge ${vType === "Home Visit" ? "badge-home" : "badge-center"}`}>
                            {vType === "Home Visit" ? "🏠 Home" : "🏥 Center"}
                          </span>
                        </td>
                        <td>{new Date(r.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
