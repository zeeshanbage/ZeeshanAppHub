import DeviceInfo from 'react-native-device-info';
import { supabase } from './supabase';

export const trackInstall = async () => {
    try {
        const uniqueId = await DeviceInfo.getUniqueId();
        const brand = await DeviceInfo.getBrand();
        const model = await DeviceInfo.getModel();
        const systemVersion = await DeviceInfo.getSystemVersion();

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
        const uniqueId = await DeviceInfo.getUniqueId();
        const systemName = await DeviceInfo.getSystemName();

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
