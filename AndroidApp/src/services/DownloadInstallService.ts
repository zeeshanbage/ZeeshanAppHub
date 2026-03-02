import RNFS from 'react-native-fs';
import IntentLauncher, { IntentConstant } from 'react-native-intent-launcher';
import { Platform, ToastAndroid } from 'react-native';

export class DownloadInstallService {
    /**
     * Downloads an APK from the given URL and triggers the install prompt.
     * 
     * @param url The URL of the APK.
     * @param fileName The name of the file to save (e.g., 'app.apk').
     * @param onProgress Callback to report download progress (0 to 1).
     */
    static async downloadAndInstall(
        url: string,
        fileName: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        if (Platform.OS !== 'android') {
            console.warn('Install intents are only supported on Android.');
            return;
        }

        // We use ExternalCachesDirectory because FileProvider is configured for it in provider_paths.xml
        const downloadDest = `${RNFS.ExternalCachesDirectoryPath}/${fileName}`;

        console.log(`Downloading ${url} to ${downloadDest}`);

        try {
            const result = RNFS.downloadFile({
                fromUrl: url,
                toFile: downloadDest,
                progress: (res) => {
                    if (onProgress && res.contentLength > 0) {
                        const progress = res.bytesWritten / res.contentLength;
                        onProgress(progress);
                    }
                },
                progressDivider: 2, // Report progress every 2%
            });

            const response = await result.promise;

            if (response.statusCode === 200) {
                console.log('Download complete. Triggering install intent...');
                await this.installApk(downloadDest);
            } else {
                throw new Error(`Download failed with status: ${response.statusCode}`);
            }
        } catch (error: any) {
            console.error('Download/Install error:', error);
            ToastAndroid.show(`Failed to download: ${error.message}`, ToastAndroid.LONG);
            throw error;
        }
    }

    /**
     * Triggers the Android ACTION_VIEW intent with the application/vnd.android.package-archive MIME type
     * to prompt the user to install the APK.
     * 
     * @param filePath The absolute path to the downloaded APK.
     */
    private static async installApk(filePath: string): Promise<void> {
        try {
            // react-native-intent-launcher uses RN's FileProvider if configured correctly
            // We prepend 'file://' if it's not already there for IntentLauncher or let it parse the path.
            // Often, for ACTION_INSTALL_PACKAGE or ACTION_VIEW on APKs, providing the content URI via FileProvider is handled internally by modern intent launcher libraries if the path is accessible.

            const fileUri = `file://${filePath}`;

            await IntentLauncher.startActivity({
                action: 'android.intent.action.VIEW',
                data: fileUri,
                type: 'application/vnd.android.package-archive',
                flags: IntentConstant.FLAG_ACTIVITY_NEW_TASK | IntentConstant.FLAG_GRANT_READ_URI_PERMISSION,
            });

        } catch (error: any) {
            console.error('Install intent failed:', error);
            ToastAndroid.show('Failed to launch installer. Ensure permissions are granted.', ToastAndroid.LONG);
            throw error;
        }
    }
}
