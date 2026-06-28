"use server";

import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Initialize Cloudflare R2 S3 Client
const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    },
});

// Helper to interact with GitHub API
const githubApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        throw new Error("Missing GITHUB_TOKEN environment variable.");
    }

    const defaultHeaders = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `token ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
    };

    const res = await fetch(`https://api.github.com${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
    }

    return res.json();
};

// --- Helper to get Supabase Admin client ---
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase credentials.");
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// --- FETCH ALL APPS ---
export async function fetchAppsAction() {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from("apps")
            .select("*");

        if (error) throw new Error(`Fetch failed: ${error.message}`);
        return { success: true, data: data || [] };
    } catch (error: any) {
        console.error("Fetch Apps Error:", error);
        return { success: false, error: error.message, data: [] };
    }
}

// --- UPDATE APP (name, version, description only) ---
export async function updateAppAction(id: string, updates: { name: string; version: string; description: string }) {
    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from("apps")
            .update({
                name: updates.name,
                version: updates.version,
                description: updates.description,
            })
            .eq("id", id);

        if (error) throw new Error(`Update failed: ${error.message}`);
        return { success: true };
    } catch (error: any) {
        console.error("Update App Error:", error);
        return { success: false, error: error.message };
    }
}

// --- DELETE APP (also cleans up GitHub Release) ---
export async function deleteAppAction(id: string) {
    const githubRepo = "zeeshanbage/ZeeshanAppHub";

    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch the app record first to get the apk_url
        const { data: app, error: fetchError } = await supabase
            .from("apps")
            .select("apk_url, icon_url")
            .eq("id", id)
            .single();

        if (fetchError) throw new Error(`Failed to fetch app for deletion: ${fetchError.message}`);

        // 2. Try to delete the APK from Cloudflare R2 or GitHub
        if (app?.apk_url) {
            const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";
            const cleanR2PublicUrl = r2PublicUrl.replace(/https?:\/\//, "").replace(/\/$/, "");

            if (app.apk_url.includes(cleanR2PublicUrl) || app.apk_url.includes(".r2.dev")) {
                try {
                    // Extract the R2 key from the download URL
                    // URL format: https://pub-xxx.r2.dev/apks/filename.apk
                    let r2Key = "";
                    const urlObj = new URL(app.apk_url);
                    r2Key = urlObj.pathname.substring(1); // Remove leading slash

                    if (r2Key) {
                        const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
                        console.log(`Deleting APK from Cloudflare R2: ${r2Key} in bucket ${r2Bucket}`);
                        await s3Client.send(
                            new DeleteObjectCommand({
                                Bucket: r2Bucket,
                                Key: r2Key,
                            })
                        );
                        console.log(`Deleted APK from R2: ${r2Key}`);
                    }
                } catch (r2Error: any) {
                    console.warn("Cloudflare R2 APK cleanup failed:", r2Error.message);
                }
            } else if (app.apk_url.includes("github.com")) {
                try {
                    // Extract the release tag from the download URL
                    // URL format: https://github.com/owner/repo/releases/download/TAG/filename.apk
                    const urlParts = app.apk_url.split("/");
                    const downloadIndex = urlParts.indexOf("download");
                    if (downloadIndex !== -1 && urlParts[downloadIndex + 1]) {
                        const releaseTag = urlParts[downloadIndex + 1];

                        // Get the release ID by tag
                        const releaseData = await githubApiRequest(`/repos/${githubRepo}/releases/tags/${releaseTag}`);

                        // Delete the release
                        const githubToken = process.env.GITHUB_TOKEN;
                        const deleteRes = await fetch(`https://api.github.com/repos/${githubRepo}/releases/${releaseData.id}`, {
                            method: "DELETE",
                            headers: {
                                "Authorization": `token ${githubToken}`,
                                "X-GitHub-Api-Version": "2022-11-28",
                            },
                        });

                        // Also delete the git tag
                        await fetch(`https://api.github.com/repos/${githubRepo}/git/refs/tags/${releaseTag}`, {
                            method: "DELETE",
                            headers: {
                                "Authorization": `token ${githubToken}`,
                                "X-GitHub-Api-Version": "2022-11-28",
                            },
                        });

                        if (deleteRes.ok) {
                            console.log(`Deleted GitHub Release: ${releaseTag}`);
                        } else {
                            console.warn(`GitHub Release deletion returned ${deleteRes.status} — proceeding with DB delete.`);
                        }
                    }
                } catch (ghError: any) {
                    // Don't block the DB delete if GitHub cleanup fails
                    console.warn("GitHub Release cleanup failed (proceeding with DB delete):", ghError.message);
                }
            }
        }

        // 3. Try to delete the icon from Supabase Storage
        if (app?.icon_url && app.icon_url.includes("/icons/")) {
            try {
                const iconPath = app.icon_url.split("/icons/")[1]?.split("?")[0];
                if (iconPath) {
                    await supabase.storage.from("icons").remove([iconPath]);
                    console.log(`Deleted icon from storage: ${iconPath}`);
                }
            } catch (iconErr: any) {
                console.warn("Icon cleanup failed:", iconErr.message);
            }
        }

        // 4. Delete the record from Supabase
        const { error } = await supabase
            .from("apps")
            .delete()
            .eq("id", id);

        if (error) throw new Error(`Delete failed: ${error.message}`);
        return { success: true };
    } catch (error: any) {
        console.error("Delete App Error:", error);
        return { success: false, error: error.message };
    }
}

// --- FETCH TELEMETRY STATS ---
export async function fetchTelemetryStatsAction() {
    try {
        const supabase = getSupabaseAdmin();
        
        // Fetch Installs Count & Latest
        const { count: installCount, error: installCountError } = await supabase
            .from("installs")
            .select("*", { count: 'exact', head: true });
            
        const { data: latestInstalls, error: installError } = await supabase
            .from("installs")
            .select("*")
            .order("last_opened", { ascending: false });

        if (installCountError) console.error("Error fetching install count:", installCountError);
        if (installError) console.error("Error fetching installs:", installError);

        // Fetch Issues Count & Latest
        const { count: issueCount, error: issueCountError } = await supabase
            .from("error_logs")
            .select("*", { count: 'exact', head: true });
            
        const { data: latestIssues, error: issueError } = await supabase
            .from("error_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);

        if (issueCountError) console.error("Error fetching issue count:", issueCountError);
        if (issueError) console.error("Error fetching issues:", issueError);

        return { 
            success: true, 
            data: {
                installCount: installCount || 0,
                latestInstalls: latestInstalls || [],
                issueCount: issueCount || 0,
                latestIssues: latestIssues || []
            }
        };
    } catch (error: any) {
        console.error("Fetch Telemetry Error:", error);
        return { success: false, error: error.message, data: null };
    }
}
