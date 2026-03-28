import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import AppInfoParser from "app-info-parser";
import { createWriteStream, createReadStream } from "fs";
import { unlink, stat } from "fs/promises";
import * as os from "os";
import * as path from "path";
import Busboy from "busboy";
import { Readable } from "stream";

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

export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubRepo = "zeeshanbage/ZeeshanAppHub";

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
        const { name, version, description } = formData;
        if (!name || !version || !description || !tempApkPath) {
            throw new Error("Missing required fields or APK file.");
        }

        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
        const releaseTag = `${sanitize(name)}-v${sanitize(version)}`;
        const apkFileName = `${sanitize(name)}_v${sanitize(version)}.apk`;

        // 1. Parse APK for icon
        let iconBuffer: Buffer;
        try {
            const parser = new AppInfoParser(tempApkPath);
            const result = await parser.parse();
            iconBuffer = Buffer.from(result.icon.replace(/^data:image\/\w+;base64,/, ""), "base64");
        } catch {
            throw new Error("Failed to extract icon from APK.");
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

        // 3. Create GitHub Release
        const releaseData = await githubApiRequest(`/repos/${githubRepo}/releases`, {
            method: "POST",
            body: JSON.stringify({
                tag_name: releaseTag,
                name: `${name} - Version ${version}`,
                body: `Release for ${name} v${version}.\n\n${description}`,
                draft: false,
                prerelease: false,
                generate_release_notes: false,
            }),
        });

        // 4. Upload APK to GitHub Release directly via streams
        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${apkFileName}`);
        const githubToken = process.env.GITHUB_TOKEN;

        const fileSize = await stat(tempApkPath).then(s => s.size);
        const fileStream = createReadStream(tempApkPath);
        
        // Convert Node.js readable to Web stream so fetch processes it directly without buffering
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
            // standard config required for streaming bodies in undici/node-fetch
            duplex: "half",
        } as any);

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`APK upload to GitHub failed: ${errText}`);
        }

        const assetData = await uploadRes.json();

        // 5. Save to DB
        const { error: dbErr } = await supabaseAdmin.from("apps").insert([{
            name,
            version,
            description,
            icon_url: iconSigned.signedUrl,
            apk_url: assetData.browser_download_url,
        }]);
        if (dbErr) throw new Error(`Database insert failed: ${dbErr.message}`);

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
