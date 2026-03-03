import { createClient } from '@supabase/supabase-js';
import { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '@env';

export const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface AppModel {
    id: string;
    name: string;
    version: string;
    icon_url: string;
    apk_url: string;
    description: string;
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
    },
    {
        id: '2',
        name: 'CloudSync Beta',
        version: '1.0.4',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2920/2920286.png',
        apk_url: 'https://example.com/app2.apk',
        description: 'Sync your files securely across all your internal devices.',
    },
    {
        id: '3',
        name: 'Hub Manager',
        version: '3.0.1',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2983/2983592.png',
        apk_url: 'https://example.com/app3.apk',
        description: 'Control your smart environment directly from your smartphone.',
    },
    {
        id: '4',
        name: 'Analytics Dashboard',
        version: '1.5.0',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2312/2312142.png',
        apk_url: 'https://example.com/app4.apk',
        description: 'Real-time metrics and analytics for your private servers.',
    },
    {
        id: '5',
        name: 'Secure Chat',
        version: '4.2.0',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2443/2443048.png',
        apk_url: 'https://example.com/app5.apk',
        description: 'End-to-end encrypted messaging for internal communications.',
    }
];

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
