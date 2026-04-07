"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import AdminUploadForm from "@/components/UploadForm";
import AppList from "@/components/AppList";
import { UploadCloud, ListChecks, Activity } from "lucide-react";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "manage", label: "Manage Apps", icon: ListChecks },
  { id: "upload", label: "Upload New", icon: UploadCloud },
] as const;

type TabId = typeof tabs[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <main className="min-h-screen bg-[#0B1120] flex flex-col items-center p-4 sm:p-8 relative overflow-hidden">

      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header/Brand */}
      <div className="w-full max-w-2xl flex justify-between items-center z-10 pt-4 sm:pt-8 mb-6 sm:mb-8 px-1">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-200 tracking-tight">App Hub Admin</h1>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="z-10 w-full max-w-2xl mb-6 sm:mb-8 px-1">
        <div className="flex bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                    ? "bg-slate-800 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-300"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="z-10 w-full">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "upload" && <AdminUploadForm />}
        {activeTab === "manage" && <AppList />}
      </div>

    </main>
  );
}
