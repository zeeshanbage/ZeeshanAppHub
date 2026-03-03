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
