"use server";

import { createClient } from "@supabase/supabase-js";
import AppInfoParser from 'app-info-parser';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

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

export async function uploadAppAction(formData: FormData) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubRepo = "zeeshanbage/ZeeshanAppHub"; // The target repository

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase Backend Credentials (SUPABASE_SERVICE_ROLE_KEY).");
    }

    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        const name = formData.get("name") as string;
        const version = formData.get("version") as string;
        const description = formData.get("description") as string;
        const apkFile = formData.get("apk") as File;

        if (!name || !version || !description || !apkFile) {
            throw new Error("Missing required form data fields.");
        }

        const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9-]/g, "");
        const releaseTag = `${sanitizeName(name)}-v${sanitizeName(version)}`;
        const apkFileName = `${sanitizeName(name)}_v${sanitizeName(version)}.apk`;

        const apkBuffer = await apkFile.arrayBuffer();

        // 1. Temporarily save APK to extract icon
        const tempApkPath = path.join(os.tmpdir(), apkFileName);
        await fs.writeFile(tempApkPath, Buffer.from(apkBuffer));

        let iconBuffer: Buffer;
        try {
            const parser = new AppInfoParser(tempApkPath);
            const result = await parser.parse();
            iconBuffer = Buffer.from(result.icon.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        } catch (e: any) {
            console.error("Failed to parse APK:", e);
            throw new Error("Failed to extract icon from APK. Ensure it is a valid Android package.");
        } finally {
            // Clean up temp file
            await fs.unlink(tempApkPath).catch(console.error);
        }

        const iconFileName = `${new Date().getTime()}.png`;

        // 2. Upload Extracted Icon to Supabase
        const { error: iconError } = await supabaseAdmin.storage
            .from("icons")
            .upload(iconFileName, iconBuffer, {
                upsert: false,
                contentType: 'image/png'
            });

        if (iconError) throw new Error(`Icon upload failed: ${iconError.message}`);

        const { data: iconSigned, error: iconSignError } = await supabaseAdmin.storage
            .from("icons")
            .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100); // 100 years

        if (iconSignError || !iconSigned) throw new Error(`Failed to sign icon URL: ${iconSignError?.message}`);

        // --- GITHUB RELEASES INTEGRATION ---

        // 3. Create the GitHub Release
        console.log(`Creating GitHub Release: ${releaseTag}`);
        const releaseData = await githubApiRequest(`/repos/${githubRepo}/releases`, {
            method: "POST",
            body: JSON.stringify({
                tag_name: releaseTag,
                name: `${name} - Version ${version}`,
                body: `Release for ${name} version ${version}.\n\nDescription: ${description}`,
                draft: false,
                prerelease: false,
                generate_release_notes: false,
            }),
        });

        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${apkFileName}`);
        const githubToken = process.env.GITHUB_TOKEN;

        // 4. Upload the APK as a Release Asset
        console.log(`Uploading APK asset to GitHub Release...`);

        // We use standard fetch here because we need to hit the raw uploadUrl, not api.github.com
        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${githubToken}`,
                "Content-Type": "application/vnd.android.package-archive",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            body: apkBuffer,
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Failed to upload asset to GitHub: ${errText}`);
        }

        const assetData = await uploadRes.json();
        const githubDownloadUrl = assetData.browser_download_url;
        console.log(`Successfully uploaded to GitHub! URL: ${githubDownloadUrl}`);

        // 5. Insert into Supabase Database
        const newApp = {
            name,
            version,
            description,
            icon_url: iconSigned.signedUrl,
            apk_url: githubDownloadUrl, // Now pointing to GitHub!
        };

        const { error: dbError } = await supabaseAdmin
            .from("apps")
            .insert([newApp]);

        if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);

        return { success: true };
    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message || "An unknown error occurred during server-side upload." };
    }
}

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

        // 2. Try to delete the GitHub Release
        if (app?.apk_url && app.apk_url.includes("github.com")) {
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
