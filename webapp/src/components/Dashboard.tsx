"use client";

import { useEffect, useState } from "react";
import { fetchTelemetryStatsAction } from "@/app/actions";
import { Activity, AlertTriangle, MonitorSmartphone, Calendar, Download } from "lucide-react";

type InstallRecord = {
  id: string;
  device_id: string;
  brand: string;
  model: string;
  system_version: string;
  last_opened: string;
};

type IssueRecord = {
  id: string;
  device_id: string;
  error_message: string;
  stack_trace: string;
  platform: string;
  created_at: string;
};

type TelemetryData = {
  installCount: number;
  latestInstalls: InstallRecord[];
  issueCount: number;
  latestIssues: IssueRecord[];
};

export default function Dashboard() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await fetchTelemetryStatsAction();
        if (result.success && result.data) {
          setData(result.data as TelemetryData);
        } else {
          setError(result.error || "Failed to load telemetry data.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex justify-center items-center h-64 bg-slate-900/40 rounded-2xl border border-slate-700/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
        Error loading dashboard: {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Installs Card */}
        <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-blue-500/20 shadow-xl shadow-blue-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <Download className="w-24 h-24 text-blue-400" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <p className="text-blue-300 font-medium tracking-wide text-sm mb-1 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" /> Total Installs
              </p>
              <h2 className="text-5xl font-extrabold text-white tracking-tight">{data?.installCount || 0}</h2>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-500/20">
              <p className="text-slate-400 text-xs">Tracking active across all devices</p>
            </div>
          </div>
        </div>

        {/* Issues Card */}
        <div className="bg-gradient-to-br from-red-900/40 to-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-red-500/20 shadow-xl shadow-red-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-24 h-24 text-red-500" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <p className="text-red-300 font-medium tracking-wide text-sm mb-1 uppercase flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Reported Issues
              </p>
              <h2 className="text-5xl font-extrabold text-white tracking-tight">{data?.issueCount || 0}</h2>
            </div>
            <div className="mt-4 pt-4 border-t border-red-500/20">
              <p className="text-slate-400 text-xs">Crash reports and tracked metrics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid for lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Installs */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
             <h3 className="font-semibold text-slate-200 flex items-center gap-2">
               <Download className="w-4 h-4 text-blue-400" /> Recent Installs
             </h3>
             <span className="text-xs px-2 py-1 bg-slate-700/50 text-slate-400 rounded-md">Last 10</span>
          </div>
          <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {data?.latestInstalls?.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No recent installs found.</p>
            ) : (
                data?.latestInstalls?.map((install) => (
                  <div key={install.id} className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex justify-between items-center hover:bg-slate-800/60 transition-colors">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <MonitorSmartphone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-200">{install.brand} {install.model || 'Unknown Device'}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">OS {install.system_version}</span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                         <Calendar className="w-3 h-3" /> {new Date(install.last_opened).toLocaleString()} • ID: {install.device_id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Issues */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
             <h3 className="font-semibold text-slate-200 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-red-500" /> Recent Issues
             </h3>
             <span className="text-xs px-2 py-1 bg-slate-700/50 text-slate-400 rounded-md">Last 10</span>
          </div>
          <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {data?.latestIssues?.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No issues reported recently.</p>
            ) : (
                data?.latestIssues?.map((issue) => (
                  <div key={issue.id} className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex flex-col gap-2 hover:bg-slate-800/60 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 uppercase font-bold tracking-wider">{issue.error_message || 'Error'}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> {issue.created_at ? new Date(issue.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-slate-800 font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">{issue.stack_trace}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <MonitorSmartphone className="w-3 h-3 text-slate-500" />
                       <span className="text-xs text-slate-500">{issue.platform} • Device ID: {issue.device_id ? `${issue.device_id.substring(0, 8)}...` : 'N/A'}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
