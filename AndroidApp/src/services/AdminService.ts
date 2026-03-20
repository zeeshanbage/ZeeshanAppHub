import { supabase } from '../config/supabase';
import { GITHUB_TOKEN, GITHUB_REPO } from '@env';
import RNFS from 'react-native-fs';

const GITHUB_API = 'https://api.github.com';

// --- GitHub API Helper ---
async function githubRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!GITHUB_TOKEN) throw new Error('Missing GITHUB_TOKEN in .env');

    const res = await fetch(`${GITHUB_API}${endpoint}`, {
        ...options,
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${errText}`);
    }

    // DELETE returns 204 No Content
    if (res.status === 204) return null;
    return res.json();
}

// --- Sanitize helper ---
const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9-]/g, '');

export class AdminService {

    // ───────── UPLOAD ─────────
    static async uploadApp(
        name: string,
        version: string,
        description: string,
        iconFilePath: string,
        apkFilePath: string,
        onProgress?: (step: string) => void,
    ): Promise<void> {
        const releaseTag = `${sanitize(name)}-v${sanitize(version)}`;
        const apkFileName = `${sanitize(name)}_v${sanitize(version)}.apk`;
        const iconFileName = `${Date.now()}.png`;

        // 1. Upload Icon to Supabase Storage
        onProgress?.('Uploading icon…');
        const iconBase64 = await RNFS.readFile(iconFilePath, 'base64');
        const iconBytes = Buffer.from(iconBase64, 'base64');

        const { error: iconErr } = await supabase.storage
            .from('icons')
            .upload(iconFileName, iconBytes, { upsert: false, contentType: 'image/png' });
        if (iconErr) throw new Error(`Icon upload failed: ${iconErr.message}`);

        const { data: iconSigned, error: signErr } = await supabase.storage
            .from('icons')
            .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100);
        if (signErr || !iconSigned) throw new Error(`Icon sign failed: ${signErr?.message}`);

        // 2. Create GitHub Release
        onProgress?.('Creating release…');
        const repo = GITHUB_REPO || 'zeeshanbage/ZeeshanAppHub';
        const releaseData = await githubRequest(`/repos/${repo}/releases`, {
            method: 'POST',
            body: JSON.stringify({
                tag_name: releaseTag,
                name: `${name} - Version ${version}`,
                body: `Release for ${name} v${version}.\n\n${description}`,
                draft: false,
                prerelease: false,
            }),
        });

        // 3. Upload APK as Release Asset
        onProgress?.('Uploading APK…');
        const uploadUrl = releaseData.upload_url.replace('{?name,label}', `?name=${apkFileName}`);
        const apkBase64 = await RNFS.readFile(apkFilePath, 'base64');
        const apkBytes = Buffer.from(apkBase64, 'base64');

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/vnd.android.package-archive',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: apkBytes,
        });
        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`APK upload failed: ${errText}`);
        }
        const assetData = await uploadRes.json();

        // 4. Insert into Supabase DB
        onProgress?.('Saving to database…');
        const { error: dbErr } = await supabase
            .from('apps')
            .insert([{
                name,
                version,
                description,
                icon_url: iconSigned.signedUrl,
                apk_url: assetData.browser_download_url,
            }]);
        if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

        onProgress?.('Done!');
    }

    // ───────── UPDATE ─────────
    static async updateApp(
        id: string,
        updates: { name: string; version: string; description: string },
    ): Promise<void> {
        const { error } = await supabase
            .from('apps')
            .update({
                name: updates.name,
                version: updates.version,
                description: updates.description,
            })
            .eq('id', id);
        if (error) throw new Error(`Update failed: ${error.message}`);
    }

    // ───────── DELETE ─────────
    static async deleteApp(id: string): Promise<void> {
        // 1. Fetch record to get URLs
        const { data: app, error: fetchErr } = await supabase
            .from('apps')
            .select('apk_url, icon_url')
            .eq('id', id)
            .single();
        if (fetchErr) throw new Error(`Fetch for delete failed: ${fetchErr.message}`);

        // 2. Try to delete GitHub Release
        if (app?.apk_url?.includes('github.com')) {
            try {
                const parts = app.apk_url.split('/');
                const dlIdx = parts.indexOf('download');
                if (dlIdx !== -1 && parts[dlIdx + 1]) {
                    const tag = parts[dlIdx + 1];
                    const repo = GITHUB_REPO || 'zeeshanbage/ZeeshanAppHub';
                    const rel = await githubRequest(`/repos/${repo}/releases/tags/${tag}`);
                    await githubRequest(`/repos/${repo}/releases/${rel.id}`, { method: 'DELETE' });
                    // Also delete tag
                    await fetch(`${GITHUB_API}/repos/${repo}/git/refs/tags/${tag}`, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `token ${GITHUB_TOKEN}`,
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                    });
                }
            } catch (e: any) {
                console.warn('GitHub cleanup failed:', e.message);
            }
        }

        // 3. Try to delete icon from Supabase Storage
        if (app?.icon_url?.includes('/icons/')) {
            try {
                const iconPath = app.icon_url.split('/icons/')[1]?.split('?')[0];
                if (iconPath) await supabase.storage.from('icons').remove([iconPath]);
            } catch (e: any) {
                console.warn('Icon cleanup failed:', e.message);
            }
        }

        // 4. Delete DB record
        const { error } = await supabase.from('apps').delete().eq('id', id);
        if (error) throw new Error(`Delete failed: ${error.message}`);
    }
}
