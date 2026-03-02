"use server";

import { createClient } from "@supabase/supabase-js";

export async function uploadAppAction(formData: FormData) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase Backend Credentials (SUPABASE_SERVICE_ROLE_KEY).");
    }

    // Initialize Supabase client with the Service Role key to bypass RLS securely
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
        const iconFile = formData.get("icon") as File;
        const apkFile = formData.get("apk") as File;

        if (!name || !version || !description || !iconFile || !apkFile) {
            throw new Error("Missing required form data fields.");
        }

        const generateFileName = (originalName: string) => {
            const ext = originalName.split(".").pop();
            const timestamp = new Date().getTime();
            const randomString = Math.random().toString(36).substring(2, 8);
            return `${timestamp}-${randomString}.${ext}`;
        };

        const iconFileName = generateFileName(iconFile.name);
        const apkFileName = generateFileName(apkFile.name);

        // Convert files to ArrayBuffer for Node.js environment upload
        const iconBuffer = await iconFile.arrayBuffer();
        const apkBuffer = await apkFile.arrayBuffer();

        // 1. Upload Icon
        const { error: iconError } = await supabaseAdmin.storage
            .from("icons")
            .upload(iconFileName, iconBuffer, {
                upsert: false,
                contentType: iconFile.type
            });

        if (iconError) throw new Error(`Icon upload failed: ${iconError.message}`);

        const { data: iconSigned, error: iconSignError } = await supabaseAdmin.storage
            .from("icons")
            .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100); // 100 years

        if (iconSignError || !iconSigned) throw new Error(`Failed to sign icon URL: ${iconSignError?.message}`);

        // 2. Upload APK
        const { error: apkError } = await supabaseAdmin.storage
            .from("apks")
            .upload(apkFileName, apkBuffer, {
                upsert: false,
                contentType: apkFile.type
            });

        if (apkError) throw new Error(`APK upload failed: ${apkError.message}`);

        const { data: apkSigned, error: apkSignError } = await supabaseAdmin.storage
            .from("apks")
            .createSignedUrl(apkFileName, 60 * 60 * 24 * 365 * 100); // 100 years

        if (apkSignError || !apkSigned) throw new Error(`Failed to sign APK URL: ${apkSignError?.message}`);

        // 3. Insert into Database
        const newApp = {
            name,
            version,
            description,
            icon_url: iconSigned.signedUrl,
            apk_url: apkSigned.signedUrl,
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
