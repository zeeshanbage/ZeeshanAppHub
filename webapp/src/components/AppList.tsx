"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, X, Check, Loader2, RefreshCw, AlertCircle, Package } from "lucide-react";
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
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: "", version: "", description: "" });
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
                </div>
            )}

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
                                    <div className="space-y-3">
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
                                                Save
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
