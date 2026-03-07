import React, { useState, useEffect } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';
import { DownloadInstallService } from '../services/DownloadInstallService';

interface AppDetailsPopupProps {
    app: AppModel | null;
    visible: boolean;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const AppDetailsPopup: React.FC<AppDetailsPopupProps> = ({ app, visible, onClose }) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDownloaded, setIsDownloaded] = useState(false);

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
                setProgress(0);
            }
        };

        checkStatus();

        const progressCallback = (prog: number) => {
            setDownloading(true);
            setProgress(prog);
            if (prog >= 1) {
                setDownloading(false);
                setIsDownloaded(true);
            }
        };

        DownloadInstallService.subscribe(fileName, progressCallback);

        return () => {
            DownloadInstallService.unsubscribe(fileName, progressCallback);
        };
    }, [app, visible]);

    if (!app) return null;

    const handleAction = async () => {
        const fileName = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;

        if (isDownloaded) {
            await DownloadInstallService.installExistingApk(fileName);
        } else {
            setDownloading(true);
            setProgress(0);
            await DownloadInstallService.downloadAndInstall(app.apk_url, fileName);
        }
    };

    const progressPercent = Math.round(progress * 100);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.sheet}>
                    {/* Decorative gradient accent */}
                    <View style={styles.sheetGlow} />

                    {/* Drag Handle */}
                    <View style={styles.handleRow}>
                        <View style={styles.handle} />
                    </View>

                    {/* Close */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Icon name="close" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {/* Hero Section */}
                        <View style={styles.hero}>
                            <View style={styles.iconGlow}>
                                <View style={styles.iconWrapper}>
                                    <Image source={{ uri: app.icon_url }} style={styles.heroIcon} />
                                </View>
                            </View>

                            <Text style={styles.heroName}>{app.name}</Text>

                            <View style={styles.badgeRow}>
                                <View style={styles.badge}>
                                    <Icon name="tag-outline" size={12} color="#38BDF8" />
                                    <Text style={styles.badgeText}>v{app.version}</Text>
                                </View>
                                <View style={[styles.badge, styles.badgePurple]}>
                                    <Icon name="android" size={12} color="#A78BFA" />
                                    <Text style={[styles.badgeText, { color: '#A78BFA' }]}>Android</Text>
                                </View>
                            </View>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Icon name="shield-check" size={20} color="#34D399" />
                                <Text style={styles.statLabel}>Verified</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Icon name="lightning-bolt" size={20} color="#FBBF24" />
                                <Text style={styles.statLabel}>Fast Install</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Icon name="lock-outline" size={20} color="#A78BFA" />
                                <Text style={styles.statLabel}>Private</Text>
                            </View>
                        </View>

                        {/* About */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>About this app</Text>
                            <Text style={styles.descText}>{app.description}</Text>
                        </View>
                    </ScrollView>

                    {/* Action Footer */}
                    <View style={styles.footer}>
                        {downloading ? (
                            <View style={styles.progressCard}>
                                <View style={styles.progressMeta}>
                                    <Text style={styles.progressLabel}>Downloading…</Text>
                                    <Text style={styles.progressPct}>{progressPercent}%</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <Animated.View
                                        style={[styles.progressFill, { width: `${progressPercent}%` }]}
                                    />
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionBtn, isDownloaded && styles.actionBtnGreen]}
                                activeOpacity={0.85}
                                onPress={handleAction}
                            >
                                <Icon
                                    name={isDownloaded ? 'check-decagram' : 'download'}
                                    size={22}
                                    color="#FFFFFF"
                                    style={{ marginRight: 10 }}
                                />
                                <Text style={styles.actionBtnText}>
                                    {isDownloaded ? 'Install Application' : 'Download & Install'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(5, 8, 20, 0.88)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#0F1629',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: height * 0.75,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(167, 139, 250, 0.1)',
        elevation: 24,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
    },
    sheetGlow: {
        position: 'absolute',
        top: 0,
        left: width * 0.15,
        right: width * 0.15,
        height: 2,
        backgroundColor: '#7C3AED',
        borderRadius: 1,
        opacity: 0.4,
    },
    handleRow: {
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 10,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    closeBtn: {
        position: 'absolute',
        top: 18,
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    hero: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    iconGlow: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 15,
        marginBottom: 18,
    },
    iconWrapper: {
        borderRadius: 28,
        backgroundColor: '#1E2440',
        borderWidth: 2,
        borderColor: 'rgba(167, 139, 250, 0.15)',
        overflow: 'hidden',
    },
    heroIcon: {
        width: 100,
        height: 100,
    },
    heroName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#F8FAFC',
        textAlign: 'center',
        letterSpacing: 0.3,
        marginBottom: 12,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.15)',
    },
    badgePurple: {
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderColor: 'rgba(167, 139, 250, 0.15)',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#38BDF8',
        letterSpacing: 0.3,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        paddingVertical: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    statItem: {
        alignItems: 'center',
        gap: 6,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        letterSpacing: 0.3,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E2E8F0',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    descText: {
        fontSize: 14,
        color: '#94A3B8',
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 36,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.04)',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: '#7C3AED',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    actionBtnGreen: {
        backgroundColor: '#059669',
        shadowColor: '#059669',
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    progressCard: {
        backgroundColor: 'rgba(167, 139, 250, 0.06)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.1)',
    },
    progressMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    progressLabel: {
        color: '#A78BFA',
        fontSize: 14,
        fontWeight: '600',
    },
    progressPct: {
        color: '#A78BFA',
        fontSize: 14,
        fontWeight: '800',
    },
    progressTrack: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#7C3AED',
        borderRadius: 3,
    },
});
