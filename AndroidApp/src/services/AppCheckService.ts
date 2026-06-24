import { NativeModules } from 'react-native';

const { AppCheckModule } = NativeModules;

export interface AppInfo {
    isInstalled: boolean;
    versionName?: string;
    versionCode?: number;
}

export const getFallbackPackageName = (appName: string): string => {
    const name = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name.includes('revancedmanager')) return 'com.revanced.net.revancedmanager';
    if (name.includes('youtuberevanced')) return 'com.google.android.youtube';
    if (name.includes('seal')) return 'com.github.junkfood.seal';
    if (name.includes('truecaller')) return 'com.truecaller';
    if (name.includes('capcut')) return 'com.lemon.lv.overseas';
    if (name.includes('moviebox')) return 'com.movieboxpro.android';
    if (name.includes('microg')) return 'com.mgoogle.android.gms';
    if (name.includes('netmirror')) return 'app.netmirror.netmirrornew';
    if (name.includes('photos')) return 'com.google.android.apps.photos';
    if (name.includes('sporzx')) return 'com.sporzx.tv';
    if (name.includes('instagram')) return 'com.instagram.android';
    return `com.zeeshan.${name}`;
};

export const isUpdateRequired = (installedVersion: string | undefined, storeVersion: string): boolean => {
    if (!installedVersion) return false;
    
    const cleanInstalled = installedVersion.trim().toLowerCase().replace(/^v/, '');
    const cleanStore = storeVersion.trim().toLowerCase().replace(/^v/, '');
    
    if (cleanInstalled === cleanStore) return false;
    
    const cleanStr = (str: string) => str.replace(/[^0-9.]/g, '');
    const instClean = cleanStr(cleanInstalled);
    const storeClean = cleanStr(cleanStore);
    
    if (!instClean || !storeClean) {
        return cleanStore > cleanInstalled;
    }
    
    const instSegs = instClean.split('.').map(x => parseInt(x, 10) || 0);
    const storeSegs = storeClean.split('.').map(x => parseInt(x, 10) || 0);
    
    const maxLen = Math.max(instSegs.length, storeSegs.length);
    for (let i = 0; i < maxLen; i++) {
        const instVal = instSegs[i] || 0;
        const storeVal = storeSegs[i] || 0;
        
        if (storeVal > instVal) return true;
        if (instVal > storeVal) return false;
    }
    
    return false;
};

export class AppCheckService {
    /**
     * Check if a specific package is installed.
     */
    static async getAppInfo(packageName: string): Promise<AppInfo> {
        if (!AppCheckModule) {
            console.warn('AppCheckModule NativeModule is not registered.');
            return { isInstalled: false };
        }
        try {
            return await AppCheckModule.getAppInfo(packageName);
        } catch (e) {
            console.error('Failed to query app package:', packageName, e);
            return { isInstalled: false };
        }
    }

    /**
     * Launch the app using its package name.
     */
    static async launchApp(packageName: string): Promise<boolean> {
        if (!AppCheckModule) {
            console.warn('AppCheckModule NativeModule is not registered.');
            return false;
        }
        try {
            return await AppCheckModule.launchApp(packageName);
        } catch (e) {
            console.error('Failed to launch app:', packageName, e);
            return false;
        }
    }
}
