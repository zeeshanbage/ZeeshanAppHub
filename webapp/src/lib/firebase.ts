import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log("Firebase Admin successfully initialized.");
        } else {
            console.warn("Firebase Admin missing credentials! Push notifications will not be sent.");
        }
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
    }
}

export const adminMessaging = admin.apps.length ? admin.messaging() : null;
