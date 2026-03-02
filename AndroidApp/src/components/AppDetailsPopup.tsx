import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Image,
    TouchableOpacity,
    Animated,
    Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';
import { DownloadInstallService } from '../services/DownloadInstallService';

interface AppDetailsPopupProps {
    app: AppModel | null;
    visible: boolean;
    onClose: () => void;
}

const { height } = Dimensions.get('window');

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

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.popupContainer}>
                    {/* Drag Handle */}
                    <View style={styles.dragHandleContainer}>
                        <View style={styles.dragHandle} />
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Icon name="close" size={20} color="#94A3B8" />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <View style={styles.iconWrapper}>
                            <Image source={{ uri: app.icon_url }} style={styles.largeIcon} />
                        </View>
                        <Text style={styles.appName}>{app.name}</Text>
                        <View style={styles.versionBadge}>
                            <Text style={styles.appVersion}>Version {app.version}</Text>
                        </View>
                    </View>

                    <View style={styles.body}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.description}>{app.description}</Text>
                    </View>

                    <View style={styles.footer}>
                        {downloading ? (
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBarBackground}>
                                    <Animated.View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${progress * 100}%` }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressText}>{Math.round(progress * 100)}% Complete</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionButton, isDownloaded && styles.actionButtonSuccess]}
                                activeOpacity={0.8}
                                onPress={handleAction}
                            >
                                <Icon name={isDownloaded ? "check-decagram" : "download"} size={24} color={isDownloaded ? "#0B132B" : "#0B132B"} style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>{isDownloaded ? "Open/Install APK" : "Download & Install"}</Text>
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
        backgroundColor: 'rgba(5, 8, 20, 0.85)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    popupContainer: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        paddingBottom: 40,
        height: height * 0.7,
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    closeButton: {
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
    },
    header: {
        alignItems: 'center',
        marginTop: 10,
    },
    iconWrapper: {
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
        marginBottom: 20,
        borderRadius: 32,
        backgroundColor: '#1E293B',
    },
    largeIcon: {
        width: 110,
        height: 110,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    appName: {
        fontSize: 28,
        fontWeight: '900',
        color: '#F8FAFC',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    versionBadge: {
        backgroundColor: 'rgba(0, 180, 216, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 180, 216, 0.3)',
    },
    appVersion: {
        fontSize: 14,
        color: '#00B4D8',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    body: {
        flex: 1,
        marginTop: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 15,
        color: '#94A3B8',
        lineHeight: 26,
    },
    footer: {
        paddingTop: 20,
    },
    actionButton: {
        backgroundColor: '#00B4D8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 20,
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    actionButtonSuccess: {
        backgroundColor: '#10B981', // Emerald green
        shadowColor: '#10B981',
    },
    actionIcon: {
        marginRight: 10,
    },
    actionButtonText: {
        color: '#0B132B',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    progressContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    progressBarBackground: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#00B4D8',
        borderRadius: 4,
    },
    progressText: {
        color: '#00B4D8',
        fontSize: 16,
        fontWeight: '700',
    }
});
