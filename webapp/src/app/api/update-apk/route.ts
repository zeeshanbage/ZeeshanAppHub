import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import AppInfoParser from "app-info-parser";
import { createWriteStream, createReadStream } from "fs";
import { unlink, stat } from "fs/promises";
import * as os from "os";
import * as path from "path";
import Busboy from "busboy";
import { Readable } from "stream";
import { adminMessaging } from "@/lib/firebase";
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

        // 1. Delete old APK (Cloudflare R2 or GitHub fallback)
        if (oldApkUrl) {
            const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";
            const cleanR2PublicUrl = r2PublicUrl.replace(/https?:\/\//, "").replace(/\/$/, "");

            if (oldApkUrl.includes(cleanR2PublicUrl) || oldApkUrl.includes(".r2.dev")) {
                try {
                    let r2Key = "";
                    const urlObj = new URL(oldApkUrl);
                    r2Key = urlObj.pathname.substring(1); // Remove leading slash

                    if (r2Key) {
                        const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
                        console.log(`Deleting old APK from Cloudflare R2: ${r2Key} in bucket ${r2Bucket}`);
                        await s3Client.send(
                            new DeleteObjectCommand({
                                Bucket: r2Bucket,
                                Key: r2Key,
                            })
                        );
                        console.log(`Deleted old APK from R2: ${r2Key}`);
                    }
                } catch (r2Error: any) {
                    console.warn("Cloudflare R2 old APK cleanup failed:", r2Error.message);
                }
            } else if (oldApkUrl.includes("github.com")) {
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
                    console.warn("Old GitHub release cleanup failed:", e.message);
                }
            }
        }

        // 2. Upload new APK to Cloudflare R2 via stream
        const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

        if (!r2Bucket || !r2PublicUrl) {
            throw new Error("Missing Cloudflare R2 environment credentials.");
        }

        const r2Key = `apks/${apkFileName}`;
        console.log(`Uploading streaming new APK to R2: ${r2Key}`);

        const fileStream = createReadStream(tempApkPath);

        await s3Client.send(
            new PutObjectCommand({
                Bucket: r2Bucket,
                Key: r2Key,
                Body: fileStream,
                ContentType: "application/vnd.android.package-archive",
            })
        );

        const newApkUrl = `${r2PublicUrl.replace(/\/$/, "")}/${r2Key}`;
        console.log(`Successfully uploaded new APK to R2! URL: ${newApkUrl}`);

        // Parse package name from new APK
        let packageName = "";
        try {
            const parser = new AppInfoParser(tempApkPath);
            const result = await parser.parse();
            packageName = result.package;
        } catch (parseErr: any) {
            console.warn("Failed to parse package name from update APK:", parseErr.message);
        }

        // 4. Update DB with new version, apk_url and package_name
        const updatePayload: any = { version: newVersion, apk_url: newApkUrl };
        if (packageName) {
            updatePayload.package_name = packageName;
        }
        const { error: dbErr, data: updatedApp } = await supabase
            .from("apps")
            .update(updatePayload)
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
