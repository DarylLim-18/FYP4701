"use client";

import { FiAlertCircle, FiBarChart2, FiMap, FiPlay } from "react-icons/fi";
import HeaderSelect from "./HeaderSelect";
import RadioGroup from "./RadioGroup";
import Slider from "./Slider";
import DatasetSelectCard from "./DatasetSelectCard";
import VariableSelect from "./VariableSelect";

export default function LisaControls({
    // dataset selection
    pickerOpen,
    setPickerOpen,
    selectedFile,
    setSelectedFile,

    // headers for column selects
    headers,

    // form state + updater
    form,
    setForm,

    // computed validation & run flags
    errors,
    canRun,
    submitting,
    onRun,
}) {
    const showAdm2NameHints = form.joinBy === "name" && form.level === "adm2";

    return (
        <section className="md:col-span-1 h-[calc(100vh-5rem)] bg-gradient-to-br from-slate-900/90 to-slate-800/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
            <div className="relative h-full">
                {/* Header */}
                <div className="border-b border-white/10 px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                            <FiBarChart2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Configure Spatial Analysis</h2>
                            <p className="text-xs text-gray-300">You are free to edit the details below</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="h-[calc(100%-5rem)] p-6 space-y-6 overflow-y-auto">

                    {/* Dataset */}
                    <div className="space-y-3">
                        <LabelDot color="indigo-400" text="Dataset" />
                        <DatasetSelectCard file={selectedFile} onOpen={() => setPickerOpen(true)} />
                        {errors.file && <Warn text={errors.file} />}
                    </div>

                    {/* Variable */}
                    {selectedFile && (
                        <div className="space-y-3">
                            <LabelDot color="emerald-400" text="Target Variable" />
                            <div className="relative">
                                <VariableSelect
                                    fileId={selectedFile.id}
                                    value={form.variable}
                                    onChange={(v) => setForm((prev) => ({ ...prev, variable: v }))}
                                />
                                {errors.variable && <Warn text={errors.variable} />}
                            </div>
                        </div>
                    )}

                    {/* Spatial Config */}
                    <div className="space-y-4">
                        <LabelDot color="blue-400" text="Spatial Configuration" />
                        <RadioGroup
                            label="Administrative Level"
                            value={form.level}
                            onChange={(v) => setForm((p) => ({ ...p, level: v }))}
                            options={[
                                { label: "Country", value: "adm0" },
                                { label: "State", value: "adm1" },
                                { label: "County", value: "adm2" },
                            ]}
                        />
                        <RadioGroup
                            label="Join Method"
                            value={form.joinBy}
                            onChange={(v) => setForm((p) => ({ ...p, joinBy: v }))}
                            options={[
                                { label: "code", value: "code" },
                                { label: "name", value: "name" },
                                { label: "point", value: "point" },
                            ]}
                        />
                    </div>

                    {/* Join-specific controls */}
                    {selectedFile?.id && headers.length > 0 && (
                        <div className="space-y-4">
                            <LabelDot color="purple-400" text="Join Configuration" />

                            {form.joinBy === "code" && (
                                <>
                                    <HeaderSelect
                                        label="Join Key Column (ISO codes like USA, MYS, …)"
                                        headers={headers}
                                        value={form.joinKey}
                                        onChange={(v) => setForm((p) => ({ ...p, joinKey: v }))}
                                        placeholder="Select code column…"
                                    />
                                    {errors.joinKey && <Warn text={errors.joinKey} />}
                                </>
                            )}

                            {form.joinBy === "name" && (
                                <div className="space-y-3">
                                    {form.level === "adm0" && (
                                        <>
                                            <HeaderSelect
                                                label="Country Column (Required)"
                                                headers={headers}
                                                value={form.countryCol}
                                                onChange={(v) => setForm((p) => ({ ...p, countryCol: v }))}
                                            />
                                            {errors.countryCol && <Warn text={errors.countryCol} />}
                                        </>
                                    )}

                                    {form.level === "adm1" && (
                                        <>
                                            <HeaderSelect
                                                label="Country Column (Required)"
                                                headers={headers}
                                                value={form.countryCol}
                                                onChange={(v) => setForm((p) => ({ ...p, countryCol: v }))}
                                            />
                                            <HeaderSelect
                                                label="State/Province Column (Required)"
                                                headers={headers}
                                                value={form.stateCol}
                                                onChange={(v) => setForm((p) => ({ ...p, stateCol: v }))}
                                            />
                                            {(errors.countryCol || errors.stateCol) && (
                                                <Warn text="Country and State are required for adm1" />
                                            )}
                                        </>
                                    )}

                                    {form.level === "adm2" && (
                                        <>
                                            <HeaderSelect
                                                label="County/District Column (Required)"
                                                headers={headers}
                                                value={form.countyCol}
                                                onChange={(v) => setForm((p) => ({ ...p, countyCol: v }))}
                                            />
                                            {errors.countyCol && <Warn text={errors.countyCol} />}

                                            <HeaderSelect
                                                label="State Column (Optional but recommended)"
                                                headers={headers}
                                                value={form.stateCol}
                                                onChange={(v) => setForm((p) => ({ ...p, stateCol: v }))}
                                            />

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-300">
                                                    country_iso3 (Recommended)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={form.countryIso3}
                                                        onChange={(e) => setForm((p) => ({ ...p, countryIso3: e.target.value }))}
                                                        placeholder="e.g., USA, MYS, IND"
                                                        className="w-full rounded-lg bg-slate-800/60 border border-white/20 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                        <FiMap className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                {showAdm2NameHints && (
                                                    <p className="text-xs text-emerald-300">
                                                        Tip: Providing country_iso3 and state_col reduces name collisions.
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {form.joinBy === "point" && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <HeaderSelect
                                            label="Longitude Column"
                                            headers={headers}
                                            value={form.lonCol}
                                            onChange={(v) => setForm((p) => ({ ...p, lonCol: v }))}
                                        />
                                        <HeaderSelect
                                            label="Latitude Column"
                                            headers={headers}
                                            value={form.latCol}
                                            onChange={(v) => setForm((p) => ({ ...p, latCol: v }))}
                                        />
                                    </div>
                                    {(errors.lonCol || errors.latCol) && (
                                        <Warn text="Longitude and Latitude columns are required for point join." />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Analysis Params */}
                    <div className="space-y-4">
                        <LabelDot color="orange-400" text="Analysis Parameters" />
                        <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20">
                            <label className="text-xs font-medium text-gray-300">Spatial Weights</label>
                            <RadioGroup
                                label=""
                                value={form.wtype}
                                onChange={(v) => setForm((p) => ({ ...p, wtype: v }))}
                                options={[
                                    { label: "queen", value: "queen" },
                                    { label: "rook", value: "rook" },
                                    { label: "kNN", value: "knn" },
                                ]}
                            />
                            {form.wtype === "knn" && (
                                <div className="mt-2">
                                    <label className="text-xs font-medium text-gray-300">k (neighbors)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={form.k}
                                        onChange={(e) => setForm((p) => ({ ...p, k: e.target.value }))}
                                        className="w-full rounded-lg bg-slate-800/60 border border-white/20 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/30 transition-all"
                                        placeholder="e.g., 8"
                                    />
                                    {errors.k && <Warn text={errors.k} />}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-300">Permutations</label>
                                <select
                                    value={form.perm}
                                    onChange={(e) => setForm((p) => ({ ...p, perm: parseInt(e.target.value, 10) }))}
                                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                >
                                    {[199, 499, 999].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <Slider
                                label="Significance Level (α)"
                                value={form.alpha}
                                min={0.001}
                                max={0.2}
                                step={0.001}
                                onChange={(v) => setForm((p) => ({ ...p, alpha: v }))}
                                hint="Default: 0.05"
                            />
                        </div>

                        <Slider
                            label="Polygon Simplification"
                            value={form.simplifyTol}
                            min={0.0005}
                            max={0.12}
                            step={0.0005}
                            onChange={(v) => setForm((p) => ({ ...p, simplifyTol: v }))}
                            hint={form.level === "adm2" ? "Counties: 0.002–0.005" : form.level === "adm1" ? "States: 0.01–0.02" : "Countries: 0.05–0.1"}
                        />
                    </div>

                    {/* Run */}
                    <div className="pt-4 border-t border-white/10">
                        {!canRun && (
                            <div className="mb-3"><Warn text="Complete required fields to enable Run." /></div>
                        )}
                        <button
                            disabled={!canRun || submitting}
                            onClick={onRun}
                            className={[
                                "w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-sm font-semibold transition-all duration-300 relative overflow-hidden group",
                                canRun && !submitting
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                                    : "bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-600/50"
                            ].join(" ")}
                        >
                            <div className="relative z-10 flex items-center gap-3">
                                <FiPlay className={`w-5 h-5 transition-transform ${submitting ? "animate-pulse" : "group-hover:scale-110"}`} />
                                <span className="font-medium">{submitting ? "Running Analysis..." : "Run Spatial Analysis"}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

function LabelDot({ color, text }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-${color}`} />
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">{text}</label>
        </div>
    );
}

function Warn({ text }) {
    return (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-1">
            <p className="text-xs text-amber-300 flex items-center gap-1">
                <FiAlertCircle className="w-3 h-3" />
                {text}
            </p>
        </div>
    );
}
