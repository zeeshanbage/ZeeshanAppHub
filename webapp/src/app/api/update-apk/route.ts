import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createWriteStream, createReadStream } from "fs";
import { unlink, stat } from "fs/promises";
import * as os from "os";
import * as path from "path";
import Busboy from "busboy";
import { Readable } from "stream";
import { adminMessaging } from "@/lib/firebase";

const githubApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) throw new Error("Missing GITHUB_TOKEN");

    const res = await fetch(`https://api.github.com${endpoint}`, {
        ...options,
        headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `token ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...options.headers,
        },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
    }
    return res.json();
};

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase credentials.");
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function POST(request: NextRequest) {
    const githubRepo = "zeeshanbage/ZeeshanAppHub";

    if (!request.body) {
        return NextResponse.json({ error: "No request body." }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    const bb = Busboy({ headers: { "content-type": contentType } });

    const fields: Record<string, string> = {};
    let tempApkPath = "";

    const parsePromise = new Promise<void>((resolve, reject) => {
        bb.on("field", (name, val) => {
            fields[name] = val;
        });

        bb.on("file", (name, file) => {
            if (name === "apk") {
                const tempFileName = `update_${Date.now()}.apk`;
                tempApkPath = path.join(os.tmpdir(), tempFileName);

                const writeStream = createWriteStream(tempApkPath);
                file.pipe(writeStream);

                file.on("error", reject);
                writeStream.on("error", reject);
            } else {
                file.resume();
            }
        });

        bb.on("finish", resolve);
        bb.on("error", reject);
    });

    try {
        const nodeStream = Readable.fromWeb(request.body as any);
        nodeStream.pipe(bb);
        await parsePromise;
    } catch {
        return NextResponse.json({ error: "Failed to parse form data." }, { status: 400 });
    }

    try {
        const { appId, appName, newVersion, oldApkUrl, notificationTitle, notificationBody } = fields;
        if (!appId || !appName || !newVersion || !tempApkPath) {
            throw new Error("Missing required fields (appId, appName, newVersion) or APK file.");
        }

        const supabase = getSupabaseAdmin();
        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
        const releaseTag = `${sanitize(appName)}-v${sanitize(newVersion)}`;
        const apkFileName = `${sanitize(appName)}_v${sanitize(newVersion)}.apk`;

        // 1. Delete old GitHub Release (best-effort)
        if (oldApkUrl && oldApkUrl.includes("github.com")) {
            try {
                const urlParts = oldApkUrl.split("/");
                const downloadIndex = urlParts.indexOf("download");
                if (downloadIndex !== -1 && urlParts[downloadIndex + 1]) {
                    const oldTag = urlParts[downloadIndex + 1];
                    const githubToken = process.env.GITHUB_TOKEN;

                    const releaseData = await githubApiRequest(`/repos/${githubRepo}/releases/tags/${oldTag}`);

                    await fetch(`https://api.github.com/repos/${githubRepo}/releases/${releaseData.id}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `token ${githubToken}`,
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    });

                    await fetch(`https://api.github.com/repos/${githubRepo}/git/refs/tags/${oldTag}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `token ${githubToken}`,
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    });

                    console.log(`Deleted old GitHub Release: ${oldTag}`);
                }
            } catch (e: any) {
                console.warn("Old release cleanup failed:", e.message);
            }
        }

        // 2. Create new GitHub Release
        const releaseData = await githubApiRequest(`/repos/${githubRepo}/releases`, {
            method: "POST",
            body: JSON.stringify({
                tag_name: releaseTag,
                name: `${appName} - Version ${newVersion}`,
                body: `Updated release for ${appName} v${newVersion}.`,
                draft: false,
                prerelease: false,
                generate_release_notes: false,
            }),
        });

        // 3. Upload APK to GitHub via stream
        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${apkFileName}`);
        const githubToken = process.env.GITHUB_TOKEN;

        const fileSize = await stat(tempApkPath).then(s => s.size);
        const fileStream = createReadStream(tempApkPath);
        const webStream = Readable.toWeb(fileStream);

        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                Accept: "application/vnd.github.v3+json",
                Authorization: `token ${githubToken}`,
                "Content-Type": "application/vnd.android.package-archive",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Length": String(fileSize),
            },
            body: webStream as any,
            duplex: "half",
        } as any);

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`APK upload to GitHub failed: ${errText}`);
        }

        const assetData = await uploadRes.json();
        const newApkUrl = assetData.browser_download_url;

        // 4. Update DB with new version and apk_url
        const { error: dbErr, data: updatedApp } = await supabase
            .from("apps")
            .update({ version: newVersion, apk_url: newApkUrl })
            .eq("id", appId)
            .select("icon_url").single();
        if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`);

        // 5. Send Push Notification via Firebase
        if (adminMessaging) {
            try {
                const finalTitle = notificationTitle || `🚀 Update Alert: ${appName}`;
                const finalBody = notificationBody || `A fresh new update (v${newVersion}) is out now! Tap to get it before everyone else. ✨`;
                await adminMessaging.send({
                    topic: "new_releases",
                    notification: {
                        title: finalTitle,
                        body: finalBody,
                    },
                    data: {
                        appId: appId,
                        action: "open_app_details",
                    },
                    android: {
                        priority: "high",
                        notification: { channelId: "app_updates" }
                    }
                });
                console.log("Firebase push notification sent successfully (update)");
            } catch (fcmErr) {
                console.warn("Firebase push notification failed:", fcmErr);
            }
        }

        return NextResponse.json({ success: true, apk_url: newApkUrl, version: newVersion });
    } catch (error: any) {
        console.error("Update APK Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempApkPath) {
            await unlink(tempApkPath).catch(() => {});
        }
    }
}
