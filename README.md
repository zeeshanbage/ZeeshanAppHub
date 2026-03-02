# 🚀 Zeeshan's App Hub

[![React Native](https://img.shields.io/badge/React_Native-v0.74-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-v14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance, private APK distribution system featuring a sleek, **Glassmorphism-designed** Android Client and a secure **Next.js Admin Dashboard**. This platform allows Zeeshan to securely upload, manage, and install private Android applications without making files public.

---

## ✨ Features

### 📱 Android Application (Client)
- **Glassmorphism UI**: Stunning transparent aesthetics with floating background orbs and premium shadows.
- **Smart Tracking**: Background download progress that persists even if you dismiss the view.
- **Instant Installation**: Automatic APK integrity checks and seamless installation via native Android intents.
- **Secure Access**: Utilizes Supabase Signed URLs (100-year expiry) to keep storage buckets 100% private.
- **Dynamic Refresh**: Pull-to-refresh to fetch the latest builds instantly.

### 🌐 Web Portal (Admin)
- **Secure Uploads**: Next.js Server Actions using the Supabase Service Role Key to bypass public RLS.
- **Icon Management**: Automatic icon and APK handling during the creation process.
- **Global Deployment**: Optimized for Vercel/Netlify hosting.

---

## 🏗️ Project Architecture

This is a **monorepo** containing two main projects:

| Directory | Type | Description |
| :--- | :--- | :--- |
| [`/AndroidApp`](./AndroidApp) | React Native | The mobile client for downloading and installing APKs. |
| [`/webapp`](./webapp) | Next.js | The administrative dashboard for managing app data. |

---

## 🛠️ Tech Stack

- **Frontend (Mobile)**: React Native (TypeScript), React Native Paper, Vector Icons.
- **Frontend (Web)**: Next.js 14, Tailwind CSS, Lucide React.
- **Backend / Storage**: [Supabase](https://supabase.com/) (PostgreSQL, Storage Buckets).
- **Tooling**: Jimp (Icon Generation), LocalTunnel (Instant Public Webaccess), Git.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Android Studio & SDK
- Supabase Account

### 2. Environment Setup
Create a `.env` file in both directories:

**AndroidApp/.env**
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**webapp/.env**
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Running the Projects

#### Running the Web Admin
```bash
cd webapp
npm install
npm run dev
```

#### Running the Android Client
```bash
cd AndroidApp
npm install
npm run android
```

---

## 📸 Screenshots

*(Add your screenshots here to WOW your users!)*

---

## 🛡️ Security
This project is built with a **Security-First** mindset:
- **Private Buckets**: Your APKs and Icons are never public.
- **Signed URLs**: The app uses temporary (but long-lived) signed tokens to download assets.
- **Service Role**: Backend operations are protected by the Supabase Service Role key, which is never exposed to the client app.

---

### Crafted by Antigravity for Zeeshan. 🌌