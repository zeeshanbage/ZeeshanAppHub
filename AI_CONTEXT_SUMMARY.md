# AI Context Summary

## Purpose
- This workspace contains an admin web portal and a React Native Android app for managing and distributing internal APKs.
- Use this document as a quick reference when a new AI session needs to understand the project architecture.
- Do not load it unnecessarily for unrelated work.

## Webapp
- Built with Next.js 16, React 19, Tailwind CSS.
- Admin UI tabs:
  - `Dashboard` shows telemetry stats.
  - `Manage Apps` edits app metadata, replaces icons, uploads APK updates, and sends test notifications.
  - `Upload New` uploads new APKs, extracts app icons, saves metadata, and publishes push notifications.
- Key files:
  - `webapp/src/app/page.tsx`
  - `webapp/src/components/Dashboard.tsx`
  - `webapp/src/components/AppList.tsx`
  - `webapp/src/components/UploadForm.tsx`
  - `webapp/src/app/actions.ts`
  - `webapp/src/app/api/upload/route.ts`

## Android App
- React Native 0.84 app using Firebase Messaging and Supabase.
- Shows a catalog of published apps, details modal, APK download/install flow, and push-notification deep linking.
- Telemetry tracks installs and crashes to Supabase.
- Key files:
  - `AndroidApp/App.tsx`
  - `AndroidApp/src/components/AppCard.tsx`
  - `AndroidApp/src/components/AppDetailsPopup.tsx`
  - `AndroidApp/src/config/supabase.ts`
  - `AndroidApp/src/config/telemetry.ts`

## Data Flow
- Admin webapp publishes app record to Supabase `apps` table.
- App icons are stored in Supabase Storage.
- APKs are stored in Cloudflare R2 using the S3-compatible API.
- Android app fetches published apps from Supabase and downloads APKs from R2 URLs.
- Push notifications are sent via Firebase topic `new_releases`.

## Important Notes
- The Android app currently may expose Supabase service keys via `@env` if not secured.
- Use this summary for project onboarding and feature planning; avoid referencing it for unrelated tasks.
