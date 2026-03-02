import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Image,
    TouchableOpacity,
    Animated
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';
import { DownloadInstallService } from '../services/DownloadInstallService';

interface AppDetailsPopupProps {
    app: AppModel | null;
    visible: boolean;
    onClose: () => void;
}

export const AppDetailsPopup: React.FC<AppDetailsPopupProps> = ({ app, visible, onClose }) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Quick reset when modal opens/closes
    React.useEffect(() => {
        if (!visible) {
            setDownloading(false);
            setProgress(0);
        }
    }, [visible]);

    if (!app) return null;

    const handleDownload = async () => {
        try {
            setDownloading(true);
            setProgress(0);

            const fileName = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;

            await DownloadInstallService.downloadAndInstall(
                app.apk_url,
                fileName,
                (prog) => setProgress(prog)
            );

        } catch {
            // Error is handled by the service, we just reset state here
        } finally {
            setDownloading(false);
            setProgress(0);
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
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Icon name="close" size={24} color="#A0AEC0" />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Image source={{ uri: app.icon_url }} style={styles.largeIcon} />
                        <Text style={styles.appName}>{app.name}</Text>
                        <Text style={styles.appVersion}>Version {app.version}</Text>
                    </View>

                    <View style={styles.divider} />

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
                                            { width: `${progress * 100}% ` }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.actionButton}
                                activeOpacity={0.8}
                                onPress={handleDownload}
                            >
                                <Icon name="cloud-download" size={24} color="#FFF" style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>Get Application</Text>
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
        backgroundColor: 'rgba(10, 15, 36, 0.7)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    popupContainer: {
        backgroundColor: '#1E293B', // Dark slate
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 24,
        minHeight: '50%',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
    },
    header: {
        alignItems: 'center',
        marginTop: 10,
    },
    largeIcon: {
        width: 90,
        height: 90,
        borderRadius: 24,
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    appName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    appVersion: {
        fontSize: 16,
        color: '#00B4D8',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 24,
    },
    body: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E2E8F0',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: '#94A3B8',
        lineHeight: 24,
    },
    footer: {
        marginTop: 32,
    },
    actionButton: {
        backgroundColor: '#00B4D8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    actionIcon: {
        marginRight: 8,
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    progressContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 16,
    },
    progressBarBackground: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#00B4D8',
        borderRadius: 4,
    },
    progressText: {
        color: '#E2E8F0',
        fontSize: 16,
        fontWeight: '600',
    }
});
