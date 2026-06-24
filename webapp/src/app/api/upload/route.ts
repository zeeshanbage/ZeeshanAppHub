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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize Cloudflare R2 S3 Client
const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    },
});

export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Missing Supabase credentials." }, { status: 500 });
    }

    if (!request.body) {
        return NextResponse.json({ error: "No request body provided." }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const contentType = request.headers.get("content-type") || "";
    const bb = Busboy({ headers: { "content-type": contentType } });

    const formData: Record<string, string> = {};
    let tempApkPath = "";

    const parsePromise = new Promise<void>((resolve, reject) => {
        bb.on("field", (name, val) => {
            formData[name] = val;
        });

        bb.on("file", (name, file, info) => {
            if (name === "apk") {
                const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
                const prefix = formData.name ? sanitize(formData.name) : "app";
                const tempFileName = `${prefix}_${Date.now()}.apk`;
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
    } catch (err: any) {
        console.error("Busboy Parse Error:", err);
        return NextResponse.json({ error: "Failed to parse form data." }, { status: 400 });
    }

    try {
        const { name, version, description, notificationTitle, notificationBody } = formData;
        if (!name || !version || !description || !tempApkPath) {
            throw new Error("Missing required fields or APK file.");
        }

        const finalTitle = notificationTitle ? notificationTitle : `🎉 New App Dropped: ${name}!`;
        const finalBody = notificationBody ? notificationBody : `Version ${version} is officially live on the Hub. Tap to check it out! 🔥`;

        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
        const releaseTag = `${sanitize(name)}-v${sanitize(version)}`;
        const apkFileName = `${sanitize(name)}_v${sanitize(version)}.apk`;

        // 1. Parse APK for icon and package name
        let iconBuffer: Buffer;
        let packageName = "";
        try {
            const parser = new AppInfoParser(tempApkPath);
            const result = await parser.parse();
            iconBuffer = Buffer.from(result.icon.replace(/^data:image\/\w+;base64,/, ""), "base64");
            packageName = result.package;
        } catch {
            throw new Error("Failed to extract icon or parse package name from APK.");
        }

        const iconFileName = `${Date.now()}.png`;

        // 2. Upload icon to Supabase
        const { error: iconErr } = await supabaseAdmin.storage
            .from("icons")
            .upload(iconFileName, iconBuffer, { upsert: false, contentType: "image/png" });
        if (iconErr) throw new Error(`Icon upload failed: ${iconErr.message}`);

        const { data: iconSigned, error: signErr } = await supabaseAdmin.storage
            .from("icons")
            .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100);
        if (signErr || !iconSigned) throw new Error(`Icon sign failed: ${signErr?.message}`);

        // 3. Upload APK to Cloudflare R2 via stream
        const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

        if (!r2Bucket || !r2PublicUrl) {
            throw new Error("Missing Cloudflare R2 environment credentials.");
        }

        const r2Key = `apks/${apkFileName}`;
        console.log(`Uploading streaming APK to R2: ${r2Key}`);

        const fileStream = createReadStream(tempApkPath);

        await s3Client.send(
            new PutObjectCommand({
                Bucket: r2Bucket,
                Key: r2Key,
                Body: fileStream,
                ContentType: "application/vnd.android.package-archive",
            })
        );

        const r2DownloadUrl = `${r2PublicUrl.replace(/\/$/, "")}/${r2Key}`;
        console.log(`Successfully uploaded to R2! URL: ${r2DownloadUrl}`);

        // 4. Save to DB
        const { error: dbErr, data: insertedApp } = await supabaseAdmin.from("apps").insert([{
            name,
            version,
            description,
            icon_url: iconSigned.signedUrl,
            apk_url: r2DownloadUrl,
            package_name: packageName,
        }]).select("id").single();
        
        if (dbErr) throw new Error(`Database insert failed: ${dbErr.message}`);

        // 6. Send Push Notification via Firebase
        if (adminMessaging) {
            try {
                const finalTitle = notificationTitle || `🎉 New App Dropped: ${name}!`;
                const finalBody = notificationBody || `Version ${version} is officially live on the Hub. Tap to check it out! 🔥`;
                await adminMessaging.send({
                    topic: "new_releases",
                    notification: {
                        title: finalTitle,
                        body: finalBody,
                    },
                    data: {
                        appId: insertedApp?.id || "",
                        action: "open_app_details",
                    },
                    android: {
                        priority: "high",
                        notification: { channelId: "app_updates" }
                    }
                });
                console.log("Firebase push notification sent successfully.");
            } catch (fcmErr) {
                console.warn("Firebase push notification failed:", fcmErr);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempApkPath) {
            await unlink(tempApkPath).catch(() => {});
        }
    }
}
