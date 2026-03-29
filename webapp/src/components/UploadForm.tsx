"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function AdminUploadForm() {
    const [formData, setFormData] = useState({
        name: "",
        version: "",
        description: "",
        notificationTitle: "",
        notificationBody: "",
    });
    const [apkFile, setApkFile] = useState<File | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing" | "done">("uploading");
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "apk") => {
        if (e.target.files && e.target.files.length > 0) {
            if (type === "apk") setApkFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.version || !formData.description || !apkFile) {
            setErrorMessage("Please fill all fields and select the APK file.");
            setStatus("error");
            return;
        }

        setIsUploading(true);
        setStatus("idle");
        setErrorMessage("");
        setUploadProgress(0);
        setUploadPhase("uploading");

        try {
            const body = new FormData();
            body.append("name", formData.name);
            body.append("version", formData.version);
            body.append("description", formData.description);
            if (formData.notificationTitle) body.append("notificationTitle", formData.notificationTitle);
            if (formData.notificationBody) body.append("notificationBody", formData.notificationBody);
            body.append("apk", apkFile);

            // Use XMLHttpRequest for upload progress tracking
            const result = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(pct);
                    }
                });

                xhr.upload.addEventListener("load", () => {
                    setUploadPhase("processing");
                });

                xhr.addEventListener("load", () => {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            setUploadPhase("done");
                            resolve(data);
                        } else {
                            reject(new Error(data.error || `Server error ${xhr.status}`));
                        }
                    } catch {
                        reject(new Error("Invalid response from server."));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
                xhr.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));

                xhr.open("POST", "/api/upload");
                xhr.send(body);
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            // Success!
            setStatus("success");
            setFormData({ name: "", version: "", description: "", notificationTitle: "", notificationBody: "" });
            setApkFile(null);
            const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
            fileInputs.forEach(input => input.value = "");

        } catch (error: any) {
            console.error("Upload process error:", error);
            setStatus("error");
            setErrorMessage(error.message || "An unknown error occurred during upload.");
        } finally {
            setIsUploading(false);
        }
    };

    const getProgressLabel = () => {
        if (uploadPhase === "uploading") return `Uploading… ${uploadProgress}%`;
        if (uploadPhase === "processing") return "Processing — extracting icon, creating release…";
        return "Complete!";
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Publish New App
                </h2>
                <p className="text-slate-400 mt-2">Upload your React Native APK and details to the hub</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* App Info Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">App Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="e.g. Zeeshan Tools Pro"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Version</label>
                            <input
                                type="text"
                                name="version"
                                value={formData.version}
                                onChange={handleInputChange}
                                className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="e.g. 1.0.0"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                            placeholder="Short description of the application..."
                            required
                        />
                    </div>
                </div>

                {/* File Upload Section */}
                <div className="pt-4 border-t border-slate-700/50">

                    {/* APK Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">APK File</label>
                        <div className="relative group rounded-xl border-2 border-dashed border-slate-600 hover:border-emerald-400 bg-slate-800/30 transition-all p-6 text-center cursor-pointer">
                            <input
                                type="file"
                                accept=".apk,application/vnd.android.package-archive"
                                onChange={(e) => handleFileChange(e, "apk")}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                required
                            />
                            <div className="flex flex-col items-center justify-center space-y-2">
                                {apkFile ? (
                                    <>
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                                        <span className="text-sm text-emerald-300 font-medium truncate max-w-full px-2">
                                            {apkFile.name}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {(apkFile.size / (1024 * 1024)).toFixed(1)} MB
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-3 bg-slate-800 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                                            <UploadCloud className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <span className="text-sm text-slate-400">Select APK</span>
                                        <span className="text-xs text-slate-500">.apk up to 100MB</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Notification Section */}
                <div className="pt-4 border-t border-slate-700/50 space-y-3">
                    <label className="block text-sm font-medium text-slate-300">Custom Push Notification <span className="text-slate-500 text-xs font-normal">(Optional)</span></label>
                    <input
                        type="text"
                        name="notificationTitle"
                        value={formData.notificationTitle}
                        onChange={handleInputChange}
                        className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Leave empty for default title"
                    />
                    <textarea
                        name="notificationBody"
                        value={formData.notificationBody}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        placeholder="Leave empty for default message"
                    />
                </div>

                {/* ── Progress Bar ── */}
                {isUploading && (
                    <div className="space-y-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-300 font-medium flex items-center gap-2">
                                {uploadPhase === "processing" ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                ) : (
                                    <UploadCloud className="w-4 h-4 text-blue-400" />
                                )}
                                {getProgressLabel()}
                            </span>
                        </div>

                        {/* Bar */}
                        <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ease-out ${
                                    uploadPhase === "processing"
                                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse"
                                        : "bg-gradient-to-r from-blue-500 to-emerald-500"
                                }`}
                                style={{
                                    width: uploadPhase === "processing" ? "100%" : `${uploadProgress}%`,
                                }}
                            />
                        </div>

                        {/* Steps */}
                        <div className="flex items-center gap-6 text-xs">
                            <span className={uploadPhase === "uploading" ? "text-blue-400 font-semibold" : "text-emerald-400"}>
                                {uploadPhase !== "uploading" ? "✓" : "●"} Upload
                            </span>
                            <span className={uploadPhase === "processing" ? "text-blue-400 font-semibold" : uploadPhase === "done" ? "text-emerald-400" : "text-slate-500"}>
                                {uploadPhase === "done" ? "✓" : uploadPhase === "processing" ? "●" : "○"} Processing
                            </span>
                            <span className={uploadPhase === "done" ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                                {uploadPhase === "done" ? "✓" : "○"} Published
                            </span>
                        </div>
                    </div>
                )}

                {/* Status Messages */}
                {status === "error" && (
                    <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="flex items-center space-x-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">App published successfully!</p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isUploading ? (
                        <span className="flex items-center justify-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{uploadPhase === "uploading" ? `Uploading ${uploadProgress}%` : "Processing…"}</span>
                        </span>
                    ) : (
                        <span className="flex items-center justify-center space-x-2">
                            <UploadCloud className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                            <span>Publish App</span>
                        </span>
                    )}
                </button>
            </form>
        </div>
    );
}
