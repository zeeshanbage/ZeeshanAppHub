"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, X, Check, Loader2, RefreshCw, AlertCircle, Package, ImagePlus, FileUp } from "lucide-react";
import { fetchAppsAction, updateAppAction, deleteAppAction } from "@/app/actions";
import { AppModel } from "@/types";

export default function AppList() {
    const [apps, setApps] = useState<AppModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: "", version: "", description: "" });
    const [saving, setSaving] = useState(false);

    // Icon update state
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [updatingIcon, setUpdatingIcon] = useState<string | null>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);

    // APK update state
    const [apkFile, setApkFile] = useState<File | null>(null);
    const [updatingApk, setUpdatingApk] = useState<string | null>(null);
    const [apkProgress, setApkProgress] = useState(0);
    const [apkPhase, setApkPhase] = useState<"idle" | "uploading" | "processing">("idle");
    const apkInputRef = useRef<HTMLInputElement>(null);

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadApps = useCallback(async () => {
        setLoading(true);
        setError("");
        const result = await fetchAppsAction();
        if (result.success) {
            setApps(result.data as AppModel[]);
        } else {
            setError(result.error || "Failed to load apps");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadApps();
    }, [loadApps]);

    const startEdit = (app: AppModel) => {
        setEditingId(app.id!);
        setEditForm({ name: app.name, version: app.version, description: app.description });
        setConfirmDeleteId(null);
        setIconFile(null);
        setIconPreview(null);
        setApkFile(null);
        setApkPhase("idle");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: "", version: "", description: "" });
        setIconFile(null);
        setIconPreview(null);
        setApkFile(null);
        setApkPhase("idle");
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        const result = await updateAppAction(editingId, editForm);
        if (result.success) {
            setApps(prev => prev.map(a => a.id === editingId ? { ...a, ...editForm } : a));
            setEditingId(null);
        } else {
            setError(result.error || "Failed to update");
        }
        setSaving(false);
    };

    // --- Icon Update ---
    const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIconFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setIconPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const uploadNewIcon = async (app: AppModel) => {
        if (!iconFile || !app.id) return;
        setUpdatingIcon(app.id);
        setError("");

        try {
            const body = new FormData();
            body.append("appId", app.id);
            body.append("oldIconUrl", app.icon_url || "");
            body.append("icon", iconFile);

            const res = await fetch("/api/update-icon", { method: "POST", body });
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            // Update local state
            setApps(prev => prev.map(a => a.id === app.id ? { ...a, icon_url: data.icon_url } : a));
            setIconFile(null);
            setIconPreview(null);
        } catch (err: any) {
            setError(err.message || "Icon update failed");
        } finally {
            setUpdatingIcon(null);
        }
    };

    // --- APK Update ---
    const handleApkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setApkFile(file);
        }
    };

    const uploadNewApk = async (app: AppModel) => {
        if (!apkFile || !app.id) return;
        setUpdatingApk(app.id);
        setApkProgress(0);
        setApkPhase("uploading");
        setError("");

        try {
            const body = new FormData();
            body.append("appId", app.id);
            body.append("appName", editForm.name || app.name);
            body.append("newVersion", editForm.version || app.version);
            body.append("oldApkUrl", app.apk_url || "");
            body.append("apk", apkFile);

            const result = await new Promise<{ success: boolean; apk_url?: string; version?: string; error?: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        setApkProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });

                xhr.upload.addEventListener("load", () => {
                    setApkPhase("processing");
                });

                xhr.addEventListener("load", () => {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || `Server error ${xhr.status}`));
                        }
                    } catch {
                        reject(new Error("Invalid response from server."));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error.")));
                xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));

                xhr.open("POST", "/api/update-apk");
                xhr.send(body);
            });

            if (!result.success) throw new Error(result.error);

            setApps(prev => prev.map(a =>
                a.id === app.id
                    ? { ...a, apk_url: result.apk_url!, version: result.version! }
                    : a
            ));
            setApkFile(null);
            setApkPhase("idle");
        } catch (err: any) {
            setError(err.message || "APK update failed");
        } finally {
            setUpdatingApk(null);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const result = await deleteAppAction(id);
        if (result.success) {
            setApps(prev => prev.filter(a => a.id !== id));
            setConfirmDeleteId(null);
        } else {
            setError(result.error || "Failed to delete");
        }
        setDeletingId(null);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-slate-400 text-sm">Loading apps…</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Uploaded Apps
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">{apps.length} app{apps.length !== 1 ? "s" : ""} published</p>
                </div>
                <button
                    onClick={loadApps}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all active:scale-95"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {error && (
                <div className="flex items-center space-x-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                    <button onClick={() => setError("")} className="ml-auto text-red-400/60 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleIconFileChange}
            />
            <input
                ref={apkInputRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={handleApkFileChange}
            />

            {apps.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                    <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">No apps published yet</p>
                    <p className="text-slate-600 text-xs mt-1">Upload your first APK to get started</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {apps.map((app) => {
                        const isEditing = editingId === app.id;
                        const isConfirmingDelete = confirmDeleteId === app.id;
                        const isDeleting = deletingId === app.id;
                        const isIconUploading = updatingIcon === app.id;
                        const isApkUploading = updatingApk === app.id;

                        return (
                            <div
                                key={app.id}
                                className={`bg-slate-900/50 backdrop-blur-sm border rounded-xl p-4 transition-all ${isEditing
                                        ? "border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                                        : "border-slate-700/50 hover:border-slate-600/50"
                                    }`}
                            >
                                {isEditing ? (
                                    /* ---- EDIT MODE ---- */
                                    <div className="space-y-4">
                                        {/* Icon + Text Fields row */}
                                        <div className="flex gap-4">
                                            {/* Clickable Icon Preview */}
                                            <div className="flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => iconInputRef.current?.click()}
                                                    disabled={isIconUploading}
                                                    className="relative w-16 h-16 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-400 overflow-hidden transition-all group disabled:opacity-50"
                                                    title="Change icon"
                                                >
                                                    {iconPreview ? (
                                                        <img src={iconPreview} alt="New icon" className="w-full h-full object-cover" />
                                                    ) : app.icon_url ? (
                                                        <img src={app.icon_url} alt={app.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                            <Package className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ImagePlus className="w-5 h-5 text-white" />
                                                    </div>
                                                </button>
                                                {/* Upload icon button */}
                                                {iconFile && (
                                                    <button
                                                        onClick={() => uploadNewIcon(app)}
                                                        disabled={isIconUploading}
                                                        className="mt-1.5 w-16 text-[10px] font-medium text-center py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
                                                    >
                                                        {isIconUploading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Save"}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Text fields */}
                                            <div className="flex-1 space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <input
                                                        value={editForm.name}
                                                        onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                                                        className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        placeholder="App Name"
                                                    />
                                                    <input
                                                        value={editForm.version}
                                                        onChange={(e) => setEditForm(p => ({ ...p, version: e.target.value }))}
                                                        className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        placeholder="Version"
                                                    />
                                                </div>
                                                <textarea
                                                    value={editForm.description}
                                                    onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                                                    rows={2}
                                                    className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                                    placeholder="Description"
                                                />
                                            </div>
                                        </div>

                                        {/* APK Update Section */}
                                        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <FileUp className="w-3.5 h-3.5" />
                                                    <span>Replace APK</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => apkInputRef.current?.click()}
                                                    disabled={isApkUploading}
                                                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600/50 transition-all disabled:opacity-50"
                                                >
                                                    Choose APK
                                                </button>
                                            </div>

                                            {apkFile && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-emerald-400 truncate max-w-[200px]">{apkFile.name}</span>
                                                        <span className="text-slate-500">{(apkFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                                                    </div>

                                                    {isApkUploading && (
                                                        <div className="space-y-1.5">
                                                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        apkPhase === "processing"
                                                                            ? "bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse w-full"
                                                                            : "bg-gradient-to-r from-blue-500 to-emerald-500"
                                                                    }`}
                                                                    style={{ width: apkPhase === "processing" ? "100%" : `${apkProgress}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-slate-500">
                                                                {apkPhase === "uploading" ? `Uploading… ${apkProgress}%` : "Processing — creating release…"}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {!isApkUploading && (
                                                        <button
                                                            onClick={() => uploadNewApk(app)}
                                                            className="w-full text-xs py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <FileUp className="w-3.5 h-3.5" />
                                                            Upload New APK (v{editForm.version})
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Save / Cancel */}
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={cancelEdit}
                                                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
                                            >
                                                <X className="w-4 h-4 inline mr-1" />Cancel
                                            </button>
                                            <button
                                                onClick={saveEdit}
                                                disabled={saving}
                                                className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> : <Check className="w-4 h-4 inline mr-1" />}
                                                Save Info
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ---- VIEW MODE ---- */
                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
                                            {app.icon_url ? (
                                                <img src={app.icon_url} alt={app.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <Package className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-semibold text-sm sm:text-base truncate">{app.name}</h3>
                                            <p className="text-slate-500 text-xs">v{app.version}</p>
                                            <p className="text-slate-400 text-xs mt-0.5 line-clamp-1 hidden sm:block">{app.description}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                                            {isConfirmingDelete ? (
                                                <>
                                                    <button
                                                        onClick={() => handleDelete(app.id!)}
                                                        disabled={isDeleting}
                                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50"
                                                    >
                                                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-slate-700 hover:text-white hover:border-slate-600 transition-all"
                                                    >
                                                        No
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(app)}
                                                        className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setConfirmDeleteId(app.id!); setEditingId(null); }}
                                                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
