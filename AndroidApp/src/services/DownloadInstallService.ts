import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import { Platform, ToastAndroid } from 'react-native';

type DownloadProgressCallback = (progress: number) => void;

export class DownloadInstallService {
    private static listeners: Map<string, DownloadProgressCallback[]> = new Map();
    private static activeProgress: Map<string, number> = new Map();

    /**
     * Subscribe to download progress for a specific file.
     */
    static subscribe(fileName: string, callback: DownloadProgressCallback) {
        if (!this.listeners.has(fileName)) {
            this.listeners.set(fileName, []);
        }
        this.listeners.get(fileName)!.push(callback);

        // Emit immediately if it is actively downloading
        if (this.activeProgress.has(fileName)) {
            callback(this.activeProgress.get(fileName)!);
        }
    }

    /**
     * Unsubscribe from download progress.
     */
    static unsubscribe(fileName: string, callback: DownloadProgressCallback) {
        if (this.listeners.has(fileName)) {
            const updated = this.listeners.get(fileName)!.filter(cb => cb !== callback);
            this.listeners.set(fileName, updated);
        }
    }

    private static updateProgress(fileName: string, progress: number) {
        this.activeProgress.set(fileName, progress);
        if (this.listeners.has(fileName)) {
            this.listeners.get(fileName)!.forEach(cb => cb(progress));
        }
    }

    private static clearTracking(fileName: string) {
        this.activeProgress.delete(fileName);
    }

    /**
     * Check if a download is currently running.
     */
    static isDownloading(fileName: string): boolean {
        return this.activeProgress.has(fileName);
    }

    /**
     * Checks if the APK file already exists perfectly on the disk.
     */
    static async isApkDownloaded(fileName: string): Promise<boolean> {
        const filePath = `${RNFS.ExternalCachesDirectoryPath}/${fileName}`;
        return await RNFS.exists(filePath);
    }

    /**
     * Install an APK that has already been verified to exist on disk.
     */
    static async installExistingApk(fileName: string): Promise<void> {
        const filePath = `${RNFS.ExternalCachesDirectoryPath}/${fileName}`;
        await this.installApk(filePath);
    }

    /**
     * Downloads an APK from the given URL and triggers the install prompt.
     * Prevents duplicate downloads if already downloading or existing.
     */
    static async downloadAndInstall(
        url: string,
        fileName: string
    ): Promise<void> {
        if (Platform.OS !== 'android') return;

        const downloadDest = `${RNFS.ExternalCachesDirectoryPath}/${fileName}`;

        // 1. Check if it's already downloaded completely
        if (await RNFS.exists(downloadDest) && !this.activeProgress.has(fileName)) {
            console.log('File already exists, jumping direct to install.');
            await this.installApk(downloadDest);
            return;
        }

        // 2. Check if a download is already in progress for this file
        if (this.activeProgress.has(fileName)) {
            console.log('Download already in progress for this file.');
            return;
        }

        console.log(`Downloading ${url} to ${downloadDest}`);
        this.updateProgress(fileName, 0);

        try {
            const result = RNFS.downloadFile({
                fromUrl: url,
                toFile: downloadDest,
                progress: (res) => {
                    if (res.contentLength > 0) {
                        const progress = res.bytesWritten / res.contentLength;
                        this.updateProgress(fileName, progress);
                    }
                },
                progressDivider: 2,
            });

            const response = await result.promise;

            if (response.statusCode === 200) {
                console.log('Download complete. Triggering install intent...');
                this.updateProgress(fileName, 1);
                this.clearTracking(fileName);
                await this.installApk(downloadDest);
            } else {
                throw new Error(`Download failed with status: ${response.statusCode}`);
            }
        } catch (error: any) {
            console.error('Download/Install error:', error);
            ToastAndroid.show(`Failed to download: ${error.message}`, ToastAndroid.LONG);
            this.clearTracking(fileName);
            throw error;
        }
    }

    private static async installApk(filePath: string): Promise<void> {
        try {
            console.log('Opening file with FileViewer:', filePath);
            // FileViewer implicitly resolves "content://" correctly for Android 7.0+
            await FileViewer.open(filePath, { showOpenWithDialog: false });
        } catch (error: any) {
            console.error('Install intent failed:', error);
            ToastAndroid.show('Failed to launch installer.', ToastAndroid.LONG);
            throw error;
        }
    }
}
