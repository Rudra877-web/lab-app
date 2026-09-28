import React, { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import SetupBanner from "../components/SetupBanner.jsx";
import { useToast } from "../components/Toast.jsx";
import { supabase, friendlyError, isSupabaseConfigured } from "../supabaseClient.js";

const HIGHLIGHT_CARE_TATS = new Set(["Health India TAT", "Visit Health", "Ericson"]);

export default function TatList() {
  const { showToast, ToastEl } = useToast();
  const [tatList, setTatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [newTatName, setNewTatName] = useState("");
  const [newHighlightCare, setNewHighlightCare] = useState(false);

  const loadTatList = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("tat_list")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { setErrorMsg(friendlyError(error)); setLoading(false); return; }
    setTatList(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTatList(); }, [loadTatList]);

  async function selectHighlightCare(row, checked) {
    const nextValue = checked ? "1" : null;
    if ((row.highlight_care || null) === nextValue) return;

    const previous = tatList;
    setTatList((list) => list.map((t) => (t.id === row.id ? { ...t, highlight_care: nextValue } : t)));
    setSavingId(row.id);

    const { error } = await supabase
      .from("tat_list")
      .update({ highlight_care: nextValue })
      .eq("id", row.id);

    setSavingId(null);

    if (error) {
      setTatList(previous);
      showToast(friendlyError(error), true);
      return;
    }
    showToast(`${row.name}: Highlight Care ${checked ? "enabled" : "disabled"}.`);
  }

  async function addTat(e) {
    e.preventDefault();

    const name = newTatName.trim();
    if (!name) {
      showToast("TPA name required hai.", true);
      return;
    }

    const exists = tatList.some((t) => t.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast("Ye TPA already exists.", true);
      return;
    }

    const nextSort = tatList.reduce((max, t) => Math.max(max, Number(t.sort_order) || 0), 0) + 1;
    const { data, error } = await supabase
      .from("tat_list")
      .insert({
        name,
        highlight_care: newHighlightCare ? "1" : null,
        sort_order: nextSort,
      })
      .select()
      .single();

    if (error) {
      showToast(friendlyError(error), true);
      return;
    }

    setTatList((list) => [...list, data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setNewTatName("");
    setNewHighlightCare(false);
    showToast(`${name} add ho gaya.`);
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <SetupBanner errorMessage={errorMsg} />

        <div className="card">
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ClipboardList size={19} strokeWidth={2.2} /> TPA List
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.87rem", marginTop: "-0.4rem" }}>
            Health India TPA, Visit Health aur Ericson ke liye Highlight Care checkbox use karo. Baki TPA names ke liye ye option nahi rahega.
          </p>

          <form onSubmit={addTat} className="tat-add-row no-print" style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Add new TPA name"
              value={newTatName}
              onChange={(e) => setNewTatName(e.target.value)}
              style={{ maxWidth: 240, marginBottom: 0 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={newHighlightCare}
                onChange={(e) => setNewHighlightCare(e.target.checked)}
              />
              Highlight Care
            </label>
            <button type="submit" className="btn btn-primary btn-sm">Add TPA</button>
          </form>

          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : tatList.length === 0 ? (
            <div className="empty-state">
              TAT list abhi khaali hai. Supabase mein sql/schema.sql run karo taaki 10 TAT entries seed ho jaayein.
            </div>
          ) : (
            <div className="tat-list">
              <div className="tat-row tat-row-head no-print">
                <div className="tat-name">TPA Name</div>
                <div>Highlight Care</div>
              </div>
              {tatList.map((row) => (
                <div className="tat-row" key={row.id}>
                  <div className="tat-name">{row.name}</div>
                  {HIGHLIGHT_CARE_TATS.has(row.name) && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(row.highlight_care)}
                        onChange={(e) => selectHighlightCare(row, e.target.checked)}
                        disabled={savingId === row.id}
                      />
                      Highlight Care
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {ToastEl}
    </>
  );
}
