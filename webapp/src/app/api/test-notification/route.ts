import { NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebase";

export async function POST(request: Request) {
    try {
        const { appId, appName, version, iconUrl, notificationTitle, notificationBody } = await request.json();

        if (!adminMessaging) {
            return NextResponse.json({ success: false, error: "Firebase Admin is not configured." }, { status: 500 });
        }

        const finalTitle = notificationTitle || `🚀 Update Alert: ${appName}`;
        const finalBody = notificationBody || `A fresh new update (v${version}) is out now! Tap to get it before everyone else. ✨`;

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

        console.log("Test Push notification sent successfully for", appName);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Test Notification API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
