"use client";

import { useEffect, useMemo, useState } from "react";
import LisaControls from "@/app/components/ModularMap/LisaControls";
import ResultsPanel from "@/app/components/ModularMap/ResultsPanel";
import DatasetPickerModal from "@/app/components/ModularMap/DatasetPickerModal";
import { BASE_URL, defaultSimplifyForLevel, normalizeISO3 } from "@/app/components/ModularMap/utils";

export default function ModularMapPage() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [headers, setHeaders] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [savedUrl, setSavedUrl] = useState(null);

  const [form, setForm] = useState({
    level: "adm2",
    joinBy: "name",
    variable: "",

    // join fields
    joinKey: "",          // required only for join_by=code
    countryIso3: "",      // optional (recommended for adm2)
    countryCol: "",       // required for adm0/adm1 only
    stateCol: "",         // required for adm1; optional for adm2
    countyCol: "",        // required for adm2
    lonCol: "",           // required only for join_by=point
    latCol: "",

    // analysis
    wtype: "rook",
    k: "",                // only for knn
    perm: 999,
    alpha: 0.05,
    simplifyTol: defaultSimplifyForLevel("adm2"), // using adm 2 for now
  });

  useEffect(() => {
    if (!selectedFile?.id) { setHeaders([]); return; }
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/files/${selectedFile.id}/headers`);
        const data = await res.json();
        const cols = Array.isArray(data?.columns) ? data.columns
          : Array.isArray(data?.headers) ? data.headers
            : Array.isArray(data) ? data : [];
        setHeaders(cols);
      } catch {
        setHeaders([]);
      }
    })();
  }, [selectedFile?.id]);

  useEffect(() => {
    setForm(p => ({
      ...p,
      // clear everything
      joinKey: p.joinBy === "code" ? p.joinKey : "",
      lonCol: p.joinBy === "point" ? p.lonCol : "",
      latCol: p.joinBy === "point" ? p.latCol : "",
      // name-join specifics per level
      countryCol: p.joinBy === "name" && (p.level === "adm0" || p.level === "adm1") ? p.countryCol : "",
      stateCol: p.joinBy === "name" && (p.level === "adm1" || p.level === "adm2") ? p.stateCol : "",
      countyCol: p.joinBy === "name" && p.level === "adm2" ? p.countyCol : "",
    }));
  }, [form.joinBy, form.level]);

  useEffect(() => {
    (async () => {
      const data = await (await fetch(`${BASE_URL}/cache`)).json();
      if (data) setGeojson(data);
    })();
  }, []);

  const errors = useMemo(() => {
    const e = {};
    if (!selectedFile?.id) e.file = "Choose a dataset.";
    if (!form.variable) e.variable = "Choose a numeric column to analyze.";

    if (form.joinBy === "code") {
      if (!form.joinKey) e.joinKey = "Select a join key column.";
    } else if (form.joinBy === "name") {
      if (form.level === "adm0") {
        if (!form.countryCol) e.countryCol = "Country column is required for adm0.";
      } else if (form.level === "adm1") {
        if (!form.countryCol) e.countryCol = "Required.";
        if (!form.stateCol) e.stateCol = "Required.";
      } else if (form.level === "adm2") {
        if (!form.countyCol) e.countyCol = "County/District column is required.";
      }
    } else if (form.joinBy === "point") {
      if (!form.lonCol) e.lonCol = "Longitude column is required.";
      if (!form.latCol) e.latCol = "Latitude column is required.";
    }

    if (form.wtype === "knn" && (!form.k || Number.isNaN(+form.k))) {
      e.k = "k is required for kNN.";
    }
    return e;
  }, [selectedFile, form]);

  const canRun = Object.keys(errors).length === 0;

  const displayColumn = useMemo(() => {
    if (form.joinBy === "name") {
      if (form.level === "adm2") return form.countyCol || "county";
      if (form.level === "adm1") return form.stateCol || "state";
      return form.countryCol || "country";
    }
    if (form.joinBy === "code") return form.joinKey || "code";
    return form.countyCol || form.stateCol || form.countryCol || "name";
  }, [form]);

  async function handleRun() {
    if (!canRun || !selectedFile?.id) return;
    setSubmitting(true); setRunError(null); setGeojson(null); setSavedUrl(null);

    const body = new URLSearchParams();
    body.set("level", form.level);
    body.set("variable", String(form.variable));
    body.set("join_by", form.joinBy);

    if (form.joinBy === "code") {
      body.set("join_key", form.joinKey);
    } else if (form.joinBy === "name") {
      if (form.level === "adm0") {
        body.set("country_col", form.countryCol);
      } else if (form.level === "adm1") {
        body.set("country_col", form.countryCol);
        body.set("state_col", form.stateCol);
      } else if (form.level === "adm2") {
        body.set("county_col", form.countyCol);
        if (form.stateCol) body.set("state_col", form.stateCol);
        if (form.countryIso3) body.set("country_iso3", normalizeISO3(form.countryIso3));
      }
    } else if (form.joinBy === "point") {
      body.set("lon_col", form.lonCol);
      body.set("lat_col", form.latCol);
    }

    body.set("wtype", form.wtype);
    if (form.wtype === "knn") body.set("k", String(parseInt(form.k, 10)));
    body.set("perm", String(form.perm));
    body.set("alpha", String(form.alpha));
    body.set("simplify_tol", String(form.simplifyTol));

    try {
      const res = await fetch(`${BASE_URL}/lisa/${selectedFile.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const gj = await res.json();
      setGeojson(gj);

      setSavedUrl(`/geojsons/lisa-${selectedFile.id}.geojson`);
    } catch (err) {
      setRunError(err?.message || "Failed to run LISA.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        {/* Controls */}
        <div className="min-h-0">
          <LisaControls
            pickerOpen={pickerOpen}
            setPickerOpen={setPickerOpen}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            headers={headers}
            form={form}
            setForm={setForm}
            errors={errors}
            canRun={canRun}
            submitting={submitting}
            onRun={handleRun}
          />
          <DatasetPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(f) => {
              setSelectedFile(f);
              setPickerOpen(false);
            }}
          />

        </div>

        {/* Map panel */}
        <section className="lg:col-span-3 min-h-0 bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <ResultsPanel
            geojson={geojson}
            savedUrl={savedUrl}
            loading={submitting}
            variable={form.variable || "value"}
            columnName={
              form.joinBy === "name"
                ? (form.level === "adm2" ? (form.countyCol || "county")
                  : form.level === "adm1" ? (form.stateCol || "state")
                    : (form.countryCol || "country"))
                : (form.joinKey || form.stateCol || "name")
            }
          />
        </section>
      </main>
    </div>
  );
}
