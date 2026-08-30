import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, ToastAndroid } from 'react-native';
import { AppCheckService } from './AppCheckService';

export interface DownloadProgressState {
    progress: number; // 0 to 1
    bytesWritten: number;
    totalBytes: number;
    formattedWritten: string;
    formattedTotal: string;
    formattedSpeed: string;
}

type DownloadProgressCallback = (state: DownloadProgressState) => void;

function formatBytes(bytes: number): string {
    if (bytes <= 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getNotificationId(fileName: string): number {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
        hash = (hash << 5) - hash + fileName.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash % 100000) + 1000;
}

export class DownloadInstallService {
    private static listeners: Map<string, DownloadProgressCallback[]> = new Map();
    private static activeProgress: Map<string, DownloadProgressState> = new Map();
    private static speedTrackers: Map<string, { lastBytes: number; lastTime: number; speed: number }> = new Map();

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

    private static updateProgress(
        fileName: string,
        bytesWritten: number,
        totalBytes: number,
        calculatedSpeed?: number
    ) {
        const progress = totalBytes > 0 ? Math.min(1, Math.max(0, bytesWritten / totalBytes)) : 0;
        
        let speedStr = '0 KB/s';
        if (calculatedSpeed !== undefined && calculatedSpeed > 0) {
            speedStr = `${formatBytes(calculatedSpeed)}/s`;
        }

        const state: DownloadProgressState = {
            progress,
            bytesWritten,
            totalBytes,
            formattedWritten: formatBytes(bytesWritten),
            formattedTotal: totalBytes > 0 ? formatBytes(totalBytes) : 'Unknown',
            formattedSpeed: speedStr,
        };

        this.activeProgress.set(fileName, state);
        if (this.listeners.has(fileName)) {
            this.listeners.get(fileName)!.forEach(cb => cb(state));
        }
    }

    private static clearTracking(fileName: string) {
        this.activeProgress.delete(fileName);
        this.speedTrackers.delete(fileName);
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
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        return fileInfo.exists;
    }

    /**
     * Install an APK that has already been verified to exist on disk.
     */
    static async installExistingApk(fileName: string): Promise<void> {
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await this.installApk(filePath);
    }

    /**
     * Downloads an APK from the given URL and triggers the install prompt.
     * Prevents duplicate downloads if already downloading or existing.
     */
    static async downloadAndInstall(
        url: string,
        fileName: string,
        appName?: string
    ): Promise<void> {
        if (Platform.OS !== 'android') return;

        const displayName = appName || fileName.replace(/\.apk$/i, '');
        const notifId = getNotificationId(fileName);
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;

        // 1. Check if it's already downloaded completely
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && !this.activeProgress.has(fileName)) {
            console.log('File already exists, jumping direct to install.');
            await this.installApk(filePath);
            return;
        }

        // 2. Check if a download is already in progress for this file
        if (this.activeProgress.has(fileName)) {
            console.log('Download already in progress for this file.');
            return;
        }

        console.log(`Downloading ${url} to ${filePath}`);
        this.updateProgress(fileName, 0, 0, 0);
        this.speedTrackers.set(fileName, {
            lastBytes: 0,
            lastTime: Date.now(),
            speed: 0,
        });

        // Show initial notification
        AppCheckService.showDownloadProgressNotification(
            notifId,
            `Downloading ${displayName}`,
            0,
            '',
            'Starting download...'
        );

        let lastNotifTime = Date.now();

        try {
            const downloadResumable = FileSystem.createDownloadResumable(
                url,
                filePath,
                {},
                (downloadProgress) => {
                    const now = Date.now();
                    const tracker = this.speedTrackers.get(fileName);
                    let currentSpeed = 0;

                    if (tracker) {
                        const timeDelta = (now - tracker.lastTime) / 1000; // in seconds
                        // Update speed estimate every 400ms or more
                        if (timeDelta >= 0.4) {
                            const bytesDelta = downloadProgress.totalBytesWritten - tracker.lastBytes;
                            const instantSpeed = bytesDelta > 0 ? bytesDelta / timeDelta : 0;
                            
                            // Exponential moving average for smooth display
                            currentSpeed = tracker.speed > 0 
                                ? tracker.speed * 0.4 + instantSpeed * 0.6 
                                : instantSpeed;

                            tracker.lastBytes = downloadProgress.totalBytesWritten;
                            tracker.lastTime = now;
                            tracker.speed = currentSpeed;
                        } else {
                            currentSpeed = tracker.speed;
                        }
                    }

                    this.updateProgress(
                        fileName,
                        downloadProgress.totalBytesWritten,
                        downloadProgress.totalBytesExpectedToWrite,
                        currentSpeed
                    );

                    // Throttle notification updates to once every 750ms to avoid flooding Android system
                    if (now - lastNotifTime >= 750) {
                        lastNotifTime = now;
                        const currentState = this.activeProgress.get(fileName);
                        if (currentState) {
                            AppCheckService.showDownloadProgressNotification(
                                notifId,
                                `Downloading ${displayName}`,
                                currentState.progress,
                                currentState.formattedSpeed,
                                `${currentState.formattedWritten} / ${currentState.formattedTotal}`
                            );
                        }
                    }
                }
            );

            const response = await downloadResumable.downloadAsync();

            if (response && response.status === 200) {
                console.log('Download complete. Triggering install intent...');
                const state = this.activeProgress.get(fileName);
                const total = state?.totalBytes || 1;
                this.updateProgress(fileName, total, total, 0);
                this.clearTracking(fileName);

                // Show persistent download complete notification with Install action
                await AppCheckService.showDownloadCompleteNotification(
                    notifId,
                    displayName,
                    filePath
                );

                await this.installApk(filePath);
            } else {
                throw new Error(`Download failed with status: ${response ? response.status : 'unknown'}`);
            }
        } catch (error: any) {
            console.error('Download/Install error:', error);
            ToastAndroid.show(`Failed to download: ${error.message}`, ToastAndroid.LONG);
            this.clearTracking(fileName);
            // Dismiss notification if download failed
            AppCheckService.dismissNotification(notifId);
            // Clean up partial download so it does not leave a corrupted APK file
            try {
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(filePath, { idempotent: true });
                }
            } catch (cleanupError) {
                console.error('Failed to clean up partial file:', cleanupError);
            }
            throw error;
        }
    }

    /**
     * Delete the downloaded APK from local cache.
     */
    static async deleteDownloadedApk(fileName: string): Promise<void> {
        try {
            const filePath = `${FileSystem.cacheDirectory}${fileName}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists) {
                console.log('Deleting cached APK:', filePath);
                await FileSystem.deleteAsync(filePath, { idempotent: true });
            }
        } catch (error) {
            console.error('Failed to delete cached APK:', error);
        }
    }

    private static async installApk(filePath: string): Promise<void> {
        try {
            console.log('Opening file with IntentLauncher:', filePath);
            const contentUri = await FileSystem.getContentUriAsync(filePath);
            
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri,
                type: 'application/vnd.android.package-archive',
                flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
            });
        } catch (error: any) {
            console.error('Install intent failed:', error);
            ToastAndroid.show('Failed to launch installer.', ToastAndroid.LONG);
            throw error;
        }
    }
}
