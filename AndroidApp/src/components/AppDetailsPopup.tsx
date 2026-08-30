import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Image,
    TouchableOpacity,
    Animated,
    Dimensions,
    ScrollView,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { AppModel, incrementDownloadCount } from '../config/supabase';
import { DownloadInstallService, DownloadProgressState } from '../services/DownloadInstallService';
import { AppCheckService, getFallbackPackageName, isUpdateRequired } from '../services/AppCheckService';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface AppDetailsPopupProps {
    app: AppModel | null;
    visible: boolean;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const AppDetailsPopup: React.FC<AppDetailsPopupProps> = ({ app, visible, onClose }) => {
    const theme = useTheme();
    const [downloading, setDownloading] = useState(false);
    const [downloadState, setDownloadState] = useState<DownloadProgressState>({
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        formattedWritten: '0 B',
        formattedTotal: '0 B',
        formattedSpeed: '0 KB/s',
    });
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [installedInfo, setInstalledInfo] = useState<{ isInstalled: boolean; versionName?: string }>({ isInstalled: false });

    // Animation values
    const slideAnim = useRef(new Animated.Value(height)).current;
    const scaleAnim = useRef(new Animated.Value(0.94)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 260,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: height,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.94,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    useEffect(() => {
        if (!app || !visible) return;

        const fileName = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;

        const checkStatus = async () => {
            const exists = await DownloadInstallService.isApkDownloaded(fileName);
            setIsDownloaded(exists);

            if (DownloadInstallService.isDownloading(fileName)) {
                setDownloading(true);
            } else {
                setDownloading(false);
                setDownloadState({
                    progress: 0,
                    bytesWritten: 0,
                    totalBytes: 0,
                    formattedWritten: '0 B',
                    formattedTotal: '0 B',
                    formattedSpeed: '0 KB/s',
                });
            }

            const pkgName = app.package_name || getFallbackPackageName(app.name);
            const info = await AppCheckService.getAppInfo(pkgName);
            setInstalledInfo(info);
        };

        checkStatus();

        const progressCallback = (state: DownloadProgressState) => {
            setDownloading(true);
            setDownloadState(state);
            if (state.progress >= 1) {
                setDownloading(false);
                setIsDownloaded(true);
                setTimeout(checkStatus, 2000);
            }
        };

        DownloadInstallService.subscribe(fileName, progressCallback);

        return () => {
            DownloadInstallService.unsubscribe(fileName, progressCallback);
        };
    }, [app, visible]);

    if (!app) return null;

    const handleAction = async () => {
        const pkgName = app.package_name || getFallbackPackageName(app.name);
        if (installedInfo.isInstalled && !isUpdateRequired(installedInfo.versionName, app.version)) {
            await AppCheckService.launchApp(pkgName);
            return;
        }

        const fileName = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;
        if (isDownloaded) {
            await DownloadInstallService.installExistingApk(fileName);
        } else {
            setDownloading(true);
            setDownloadState({
                progress: 0,
                bytesWritten: 0,
                totalBytes: 0,
                formattedWritten: '0 B',
                formattedTotal: '0 B',
                formattedSpeed: '0 KB/s',
            });
            incrementDownloadCount(app.id, app.download_count || 0);
            await DownloadInstallService.downloadAndInstall(app.apk_url, fileName, app.name);
        }
    };

    const handleDelete = async () => {
        const fileName = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;
        try {
            await DownloadInstallService.deleteDownloadedApk(fileName);
            setIsDownloaded(false);
            setDownloadState({
                progress: 0,
                bytesWritten: 0,
                totalBytes: 0,
                formattedWritten: '0 B',
                formattedTotal: '0 B',
                formattedSpeed: '0 KB/s',
            });
        } catch (e) {
            console.error('Failed to delete APK:', e);
        }
    };

    const progressPercent = Math.round(downloadState.progress * 100);
    const updateNeeded = installedInfo.isInstalled && isUpdateRequired(installedInfo.versionName, app.version);

    const styles = getStyles(theme);

    return (
        <Modal
            transparent={false}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
            animationType="slide"
        >
            <View style={styles.fullScreenContainer}>
                {/* Top App Bar with Back Button */}
                <View style={styles.topAppBar}>
                    <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
                        <Icon name="arrow-left" size={24} color={theme.onSurface} />
                    </TouchableOpacity>
                    <Text style={styles.topAppBarTitle} numberOfLines={1}>App Details</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header Hero */}
                    <View style={styles.hero}>
                        <View style={styles.iconWrapper}>
                            <Image source={{ uri: app.icon_url }} style={styles.heroIcon} />
                        </View>

                        <Text style={styles.heroName}>{app.name}</Text>

                        <View style={styles.badgeRow}>
                            <View style={styles.badge}>
                                <Icon name="tag-outline" size={13} color={theme.primary} />
                                <Text style={styles.badgeText}>v{app.version}</Text>
                            </View>
                            <View style={[styles.badge, styles.badgeSecondary]}>
                                <Icon name="android" size={13} color={theme.secondary} />
                                <Text style={[styles.badgeText, { color: theme.secondary }]}>Android</Text>
                            </View>
                            {app.download_count !== undefined && app.download_count > 0 && (
                                <View style={styles.badge}>
                                    <Icon name="download-outline" size={13} color={theme.tertiary} />
                                    <Text style={[styles.badgeText, { color: theme.tertiary }]}>{app.download_count} installs</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Bento Metrics / Feature Cards */}
                    <View style={styles.bentoStatsGrid}>
                        <View style={styles.statTile}>
                            <View style={styles.statIconBox}>
                                <Icon name="shield-check" size={22} color="#34D399" />
                            </View>
                            <Text style={styles.statTileTitle}>Verified</Text>
                            <Text style={styles.statTileSubtitle}>Clean & Safe</Text>
                        </View>

                        <View style={styles.statTile}>
                            <View style={styles.statIconBox}>
                                <Icon name="lightning-bolt" size={22} color="#FBBF24" />
                            </View>
                            <Text style={styles.statTileTitle}>Fast Install</Text>
                            <Text style={styles.statTileSubtitle}>Direct APK</Text>
                        </View>

                        <View style={styles.statTile}>
                            <View style={styles.statIconBox}>
                                <Icon name="lock-check" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.statTileTitle}>Private</Text>
                            <Text style={styles.statTileSubtitle}>No Tracking</Text>
                        </View>
                    </View>

                    {/* Version Info Card if Installed */}
                    {installedInfo.isInstalled && (
                        <View style={styles.versionCard}>
                            <View style={styles.versionRow}>
                                <Text style={styles.versionLabel}>Installed Version</Text>
                                <Text style={styles.versionVal}>v{installedInfo.versionName}</Text>
                            </View>
                            <View style={styles.versionDivider} />
                            <View style={styles.versionRow}>
                                <Text style={styles.versionLabel}>Store Version</Text>
                                <Text style={[styles.versionVal, updateNeeded && { color: theme.primary, fontWeight: '800' }]}>
                                    v{app.version} {updateNeeded ? '(Update Available)' : '(Latest)'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Description Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About this application</Text>
                        <Text style={styles.descText}>{app.description}</Text>
                    </View>

                    {/* Technical details bento */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>App Information</Text>
                        <View style={styles.infoTableCard}>
                            <View style={styles.infoTableRow}>
                                <Text style={styles.infoTableLabel}>Package</Text>
                                <Text style={styles.infoTableValue} numberOfLines={1}>
                                    {app.package_name || getFallbackPackageName(app.name)}
                                </Text>
                            </View>
                            <View style={styles.infoTableDivider} />
                            <View style={styles.infoTableRow}>
                                <Text style={styles.infoTableLabel}>Release Status</Text>
                                <Text style={[styles.infoTableValue, { color: '#34D399' }]}>Stable Build</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {/* Bottom Action Bar */}
                <View style={styles.footer}>
                    {downloading ? (
                        <View style={styles.progressCard}>
                            <View style={styles.progressMeta}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Icon name="download" size={16} color={theme.primary} />
                                    <Text style={styles.progressLabel}>Downloading APK...</Text>
                                </View>
                                <Text style={styles.progressPct}>{progressPercent}%</Text>
                            </View>

                            <View style={styles.progressTrack}>
                                <Animated.View
                                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                                />
                            </View>

                            <View style={styles.progressStatsRow}>
                                <View style={styles.progressStatGroup}>
                                    <Icon name="file-download-outline" size={13} color={theme.onSurfaceVariant} />
                                    <Text style={styles.progressStatText}>
                                        {downloadState.formattedWritten} / {downloadState.formattedTotal}
                                    </Text>
                                </View>
                                <View style={styles.progressStatGroup}>
                                    <Icon name="speedometer" size={13} color={theme.primary} />
                                    <Text style={[styles.progressStatText, { color: theme.primary, fontWeight: '700' }]}>
                                        {downloadState.formattedSpeed}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    installedInfo.isInstalled && !updateNeeded && styles.actionBtnGreen,
                                    updateNeeded && styles.actionBtnUpdate,
                                    { flex: 1 }
                                ]}
                                activeOpacity={0.85}
                                onPress={handleAction}
                            >
                                <Icon
                                    name={
                                        installedInfo.isInstalled
                                            ? (!updateNeeded ? 'play-outline' : 'update')
                                            : (isDownloaded ? 'check-decagram-outline' : 'download')
                                    }
                                    size={20}
                                    color={installedInfo.isInstalled && !updateNeeded ? theme.primaryContainer : theme.onPrimary}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={[
                                    styles.actionBtnText,
                                    installedInfo.isInstalled && !updateNeeded && styles.actionBtnGreenText
                                ]}>
                                    {installedInfo.isInstalled
                                        ? (!updateNeeded ? 'Open App' : 'Update Now')
                                        : (isDownloaded ? 'Install APK' : 'Download & Install')}
                                </Text>
                            </TouchableOpacity>

                            {isDownloaded && (
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    activeOpacity={0.7}
                                    onPress={handleDelete}
                                >
                                    <Icon name="delete-outline" size={20} color={theme.error} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        backgroundColor: theme.surface,
    },
    topAppBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardBorder,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.surfaceContainerHigh,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.outlineVariant,
    },
    topAppBarTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.onSurface,
        letterSpacing: -0.2,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 32,
    },
    hero: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconWrapper: {
        width: 96,
        height: 96,
        borderRadius: 22,
        backgroundColor: theme.surfaceVariant,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.cardBorder,
        marginBottom: 16,
        elevation: theme.isDark ? 8 : 4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: theme.isDark ? 0.35 : 0.1,
        shadowRadius: 10,
    },
    heroIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    heroName: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.onSurface,
        textAlign: 'center',
        letterSpacing: -0.3,
        marginBottom: 12,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surfaceContainerHigh,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
        borderWidth: 1,
        borderColor: theme.outlineVariant,
    },
    badgeSecondary: {
        backgroundColor: 'rgba(94, 92, 230, 0.15)',
        borderColor: 'rgba(94, 92, 230, 0.25)',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.onSurface,
    },
    bentoStatsGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    statTile: {
        flex: 1,
        backgroundColor: theme.surfaceContainer,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statTileTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.onSurface,
    },
    statTileSubtitle: {
        fontSize: 11,
        color: theme.onSurfaceVariant,
        marginTop: 2,
    },
    versionCard: {
        backgroundColor: theme.surfaceContainer,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    versionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    versionLabel: {
        fontSize: 13,
        color: theme.onSurfaceVariant,
        fontWeight: '500',
    },
    versionVal: {
        fontSize: 13,
        color: theme.onSurface,
        fontWeight: '700',
    },
    versionDivider: {
        height: 1,
        backgroundColor: theme.outlineVariant,
        marginVertical: 10,
        opacity: 0.4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.onSurface,
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    descText: {
        fontSize: 14,
        color: theme.onSurfaceVariant,
        lineHeight: 22,
    },
    infoTableCard: {
        backgroundColor: theme.surfaceContainer,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    infoTableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    infoTableLabel: {
        fontSize: 13,
        color: theme.onSurfaceVariant,
    },
    infoTableValue: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.onSurface,
        maxWidth: '65%',
    },
    infoTableDivider: {
        height: 1,
        backgroundColor: theme.outlineVariant,
        marginVertical: 8,
        opacity: 0.3,
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.cardBorder,
        backgroundColor: theme.surface,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: theme.primary,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    actionBtnUpdate: {
        backgroundColor: theme.primary,
    },
    actionBtnGreen: {
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.3)',
        shadowOpacity: 0,
        elevation: 0,
    },
    actionBtnText: {
        color: theme.onPrimary,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    actionBtnGreenText: {
        color: theme.primaryContainer,
    },
    deleteBtn: {
        width: 54,
        height: 54,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.3)',
    },
    progressCard: {
        backgroundColor: theme.surfaceContainer,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.outlineVariant,
    },
    progressMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    progressLabel: {
        color: theme.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    progressPct: {
        color: theme.primary,
        fontSize: 14,
        fontWeight: '800',
    },
    progressTrack: {
        width: '100%',
        height: 6,
        backgroundColor: theme.surfaceVariant,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: theme.primary,
        borderRadius: 3,
    },
    progressStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    progressStatGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    progressStatText: {
        fontSize: 12,
        color: theme.onSurfaceVariant,
        fontWeight: '600',
    },
});
