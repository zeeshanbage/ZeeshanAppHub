import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const getUniqueId = async (): Promise<string> => {
    if (Platform.OS === 'android') {
        return Application.getAndroidId() || 'unknown-android-id';
    } else {
        const iosId = await Application.getIosIdForVendorAsync();
        return iosId || 'unknown-ios-id';
    }
};

export const trackInstall = async () => {
    try {
        const uniqueId = await getUniqueId();
        const brand = Device.brand || 'unknown-brand';
        const model = Device.modelName || 'unknown-model';
        const systemVersion = Device.osVersion || 'unknown-version';

        // Perform an UPSERT to update 'last_opened' without duplicating the device entry for 'installed_at'
        const { error } = await supabase.from('installs').upsert(
            {
                device_id: uniqueId,
                brand,
                model,
                system_version: systemVersion,
                last_opened: new Date().toISOString()
            },
            { onConflict: 'device_id' }
        );

        if (error) {
            console.warn('Telemetry: Fail to track install', error);
        } else {
            console.log('Telemetry: App Launch tracked safely.');
        }
    } catch (e) {
        console.error('Telemetry Error:', e);
    }
};

export const logFatalCrash = async (errorString: string, isFatal: boolean) => {
    try {
        const uniqueId = await getUniqueId();
        const systemName = Device.osName || Platform.OS;

        const { error } = await supabase.from('error_logs').insert({
            device_id: uniqueId,
            error_message: isFatal ? 'Fatal Crash' : 'Caught Exception',
            stack_trace: errorString,
            platform: systemName
        });

        if (error) {
            console.warn('Telemetry: Failed to upload crash log', error);
        }
    } catch (e) {
        console.error('Telemetry Crash Logger Error:', e);
    }
};
