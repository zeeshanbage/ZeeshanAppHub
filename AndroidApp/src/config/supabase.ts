import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AppModel {
    id: string;
    name: string;
    version: string;
    icon_url: string;
    apk_url: string;
    description: string;
    download_count?: number;
    created_at?: string;
    tag?: 'NEW' | 'MOST DOWNLOADED' | null;
}

// Temporary Mock Data for UI Development
export const MOCK_APPS: AppModel[] = [
    {
        id: '1',
        name: 'Zeeshan Tools Pro',
        version: '2.1.0',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2880/2880661.png',
        apk_url: 'https://example.com/app1.apk',
        description: 'Advanced toolset designed exclusively for the Zeeshan Hub ecosystem.',
        download_count: 42,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
    },
    {
        id: '2',
        name: 'CloudSync Beta',
        version: '1.0.4',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2920/2920286.png',
        apk_url: 'https://example.com/app2.apk',
        description: 'Sync your files securely across all your internal devices.',
        download_count: 12,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    },
    {
        id: '3',
        name: 'Hub Manager',
        version: '3.0.1',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2983/2983592.png',
        apk_url: 'https://example.com/app3.apk',
        description: 'Control your smart environment directly from your smartphone.',
        download_count: 98, // MOST DOWNLOADED
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    },
    {
        id: '4',
        name: 'Analytics Dashboard',
        version: '1.5.0',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2312/2312142.png',
        apk_url: 'https://example.com/app4.apk',
        description: 'Real-time metrics and analytics for your private servers.',
        download_count: 3,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: '5',
        name: 'Secure Chat',
        version: '4.2.0',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2443/2443048.png',
        apk_url: 'https://example.com/app5.apk',
        description: 'End-to-end encrypted messaging for internal communications.',
        download_count: 55, // NEW & SECOND HIGHEST
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    }
];

export const incrementDownloadCount = async (appId: string, currentCount: number) => {
    try {
        console.log(`Incrementing download count for app ${appId}. Current: ${currentCount}`);
        const { error } = await supabase
            .from('apps')
            .update({ download_count: currentCount + 1 })
            .eq('id', appId);

        if (error) {
            console.warn('Failed to increment download count in Supabase:', error);
        } else {
            console.log('Successfully incremented download count.');
        }
    } catch (e) {
        console.error('Error incrementing download count:', e);
    }
};

export const fetchApps = async (): Promise<AppModel[]> => {
    try {
        // Attempt to fetch from Supabase
        const { data, error } = await supabase.from('apps').select('*');

        if (error || !data || data.length === 0) {
            console.warn('Supabase fetch failed or returned empty. Using mock data.', error);
            return Promise.resolve(MOCK_APPS);
        }

        return data as AppModel[];
    } catch (err) {
        console.error('Error fetching apps:', err);
        // Fallback to mock data for development
        return Promise.resolve(MOCK_APPS);
    }
};
