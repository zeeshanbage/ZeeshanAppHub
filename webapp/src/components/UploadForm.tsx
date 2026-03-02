"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { uploadAppAction } from "@/app/actions";

export default function AdminUploadForm() {
    const [formData, setFormData] = useState({
        name: "",
        version: "",
        description: "",
    });
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [apkFile, setApkFile] = useState<File | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "icon" | "apk") => {
        if (e.target.files && e.target.files.length > 0) {
            if (type === "icon") setIconFile(e.target.files[0]);
            if (type === "apk") setApkFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.version || !formData.description || !iconFile || !apkFile) {
            setErrorMessage("Please fill all fields and select both files.");
            setStatus("error");
            return;
        }

        setIsUploading(true);
        setStatus("idle");
        setErrorMessage("");

        try {
            const formDataObj = new FormData();
            formDataObj.append("name", formData.name);
            formDataObj.append("version", formData.version);
            formDataObj.append("description", formData.description);
            formDataObj.append("icon", iconFile);
            formDataObj.append("apk", apkFile);

            // Execute secure Server Action
            const result = await uploadAppAction(formDataObj);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Success! Reset form
            setStatus("success");
            setFormData({ name: "", version: "", description: "" });
            setIconFile(null);
            setApkFile(null);

            // Reset file input elements to clear their UI display
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">

                    {/* Icon Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">App Icon (Image)</label>
                        <div className="relative group rounded-xl border-2 border-dashed border-slate-600 hover:border-blue-400 bg-slate-800/30 transition-all p-6 text-center cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, "icon")}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                required
                            />
                            <div className="flex flex-col items-center justify-center space-y-2">
                                {iconFile ? (
                                    <>
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                                        <span className="text-sm text-emerald-300 font-medium truncate max-w-full px-2">
                                            {iconFile.name}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-3 bg-slate-800 rounded-full group-hover:bg-blue-500/20 transition-colors">
                                            <UploadCloud className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <span className="text-sm text-slate-400">Select Image</span>
                                        <span className="text-xs text-slate-500">PNG, JPG up to 2MB</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

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
                        <p className="text-sm">App published successfully to Supabase!</p>
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
                            <span>Uploading to Supabase...</span>
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
