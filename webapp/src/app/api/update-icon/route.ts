import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";
import { Readable } from "stream";

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
    if (!request.body) {
        return NextResponse.json({ error: "No request body." }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    const bb = Busboy({ headers: { "content-type": contentType } });

    const fields: Record<string, string> = {};
    let iconChunks: Buffer[] = [];

    const parsePromise = new Promise<void>((resolve, reject) => {
        bb.on("field", (name, val) => {
            fields[name] = val;
        });

        bb.on("file", (name, file) => {
            if (name === "icon") {
                file.on("data", (chunk: Buffer) => {
                    iconChunks.push(chunk);
                });
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
        const { appId, oldIconUrl } = fields;
        if (!appId || iconChunks.length === 0) {
            return NextResponse.json({ error: "Missing appId or icon file." }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const iconBuffer = Buffer.concat(iconChunks);
        iconChunks = []; // free memory

        // 1. Delete old icon from Supabase Storage (best-effort)
        if (oldIconUrl && oldIconUrl.includes("/icons/")) {
            try {
                const iconPath = oldIconUrl.split("/icons/")[1]?.split("?")[0];
                if (iconPath) {
                    await supabase.storage.from("icons").remove([iconPath]);
                }
            } catch (e) {
                console.warn("Old icon cleanup failed:", e);
            }
        }

        // 2. Upload new icon
        const iconFileName = `${Date.now()}.png`;
        const { error: uploadErr } = await supabase.storage
            .from("icons")
            .upload(iconFileName, iconBuffer, { upsert: false, contentType: "image/png" });
        if (uploadErr) throw new Error(`Icon upload failed: ${uploadErr.message}`);

        // 3. Get signed URL
        const { data: signed, error: signErr } = await supabase.storage
            .from("icons")
            .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100);
        if (signErr || !signed) throw new Error(`Icon sign failed: ${signErr?.message}`);

        // 4. Update DB
        const { error: dbErr } = await supabase
            .from("apps")
            .update({ icon_url: signed.signedUrl })
            .eq("id", appId);
        if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`);

        return NextResponse.json({ success: true, icon_url: signed.signedUrl });
    } catch (error: any) {
        console.error("Update Icon Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
