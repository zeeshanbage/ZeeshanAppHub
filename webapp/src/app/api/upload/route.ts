import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import AppInfoParser from "app-info-parser";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        const formData = await request.formData();
        const name = formData.get("name") as string;
        const version = formData.get("version") as string;
        const description = formData.get("description") as string;
        const apkFile = formData.get("apk") as File;

        if (!name || !version || !description || !apkFile) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
        const releaseTag = `${sanitize(name)}-v${sanitize(version)}`;
        const apkFileName = `${sanitize(name)}_v${sanitize(version)}.apk`;
        const apkBuffer = await apkFile.arrayBuffer();

        // 1. Parse APK for icon
        const tempApkPath = path.join(os.tmpdir(), apkFileName);
        await fs.writeFile(tempApkPath, Buffer.from(apkBuffer));

        let iconBuffer: Buffer;
        try {
            const parser = new AppInfoParser(tempApkPath);
            const result = await parser.parse();
            iconBuffer = Buffer.from(result.icon.replace(/^data:image\/\w+;base64,/, ""), "base64");
        } catch {
            throw new Error("Failed to extract icon from APK.");
        } finally {
            await fs.unlink(tempApkPath).catch(() => {});
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

        // 4. Upload APK to GitHub Release
        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${apkFileName}`);
        const githubToken = process.env.GITHUB_TOKEN;

        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                Accept: "application/vnd.github.v3+json",
                Authorization: `token ${githubToken}`,
                "Content-Type": "application/vnd.android.package-archive",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            body: apkBuffer,
        });

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
    }
}
