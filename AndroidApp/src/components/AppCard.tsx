import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';
import { AppCheckService, getFallbackPackageName, isUpdateRequired } from '../services/AppCheckService';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface AppCardProps {
    app: AppModel;
    onPress: (app: AppModel) => void;
}

export const AppCard: React.FC<AppCardProps> = ({ app, onPress }) => {
    const theme = useTheme();
    const [btnText, setBtnText] = useState<'GET' | 'OPEN' | 'UPDATE'>('GET');
    const pkgName = app.package_name || getFallbackPackageName(app.name);

    useEffect(() => {
        const checkStatus = async () => {
            const info = await AppCheckService.getAppInfo(pkgName);
            if (info.isInstalled) {
                if (isUpdateRequired(info.versionName, app.version)) {
                    setBtnText('UPDATE');
                } else {
                    setBtnText('OPEN');
                }
            } else {
                setBtnText('GET');
            }
        };
        checkStatus();
    }, [app.version, pkgName]);

    const handleBtnPress = async () => {
        if (btnText === 'OPEN') {
            await AppCheckService.launchApp(pkgName);
        } else {
            onPress(app);
        }
    };

    const styles = getStyles(theme);

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPress(app)}>
            {/* Top Row: Icon + Info + More Button */}
            <View style={styles.topSection}>
                <View style={styles.iconWrapper}>
                    <Image source={{ uri: app.icon_url }} style={styles.icon} />
                </View>

                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{app.name}</Text>
                    <Text style={styles.desc} numberOfLines={1}>{app.description}</Text>
                    
                    {/* Status subtitle matching Stitch design */}
                    <View style={styles.statusRow}>
                        {btnText === 'UPDATE' ? (
                            <View style={styles.updateStatus}>
                                <Icon name="update" size={13} color={theme.primary} />
                                <Text style={styles.updateStatusText}>Update available</Text>
                            </View>
                        ) : btnText === 'OPEN' ? (
                            <View style={styles.installedStatus}>
                                <Icon name="check-circle-outline" size={13} color={theme.primaryContainer} />
                                <Text style={styles.installedStatusText}>Installed • v{app.version}</Text>
                            </View>
                        ) : (
                            <Text style={styles.versionText}>v{app.version}</Text>
                        )}
                        
                        {app.tag === 'NEW' && (
                            <View style={styles.newTag}>
                                <Text style={styles.newTagText}>NEW</Text>
                            </View>
                        )}
                        {app.tag === 'MOST DOWNLOADED' && (
                            <View style={styles.popularTag}>
                                <Text style={styles.popularTagText}>POPULAR</Text>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity style={styles.moreBtn} onPress={() => onPress(app)}>
                    <Icon name="dots-vertical" size={20} color={theme.onSurfaceVariant} />
                </TouchableOpacity>
            </View>

            {/* Bottom Actions Row matching Stitch Card Buttons */}
            <View style={styles.actionsRow}>
                <TouchableOpacity 
                    style={[
                        styles.primaryActionBtn,
                        btnText === 'UPDATE' && styles.updateActionBtn,
                        btnText === 'OPEN' && styles.openActionBtn
                    ]} 
                    activeOpacity={0.8} 
                    onPress={handleBtnPress}
                >
                    <Icon 
                        name={btnText === 'OPEN' ? 'play-outline' : btnText === 'UPDATE' ? 'update' : 'download'} 
                        size={16} 
                        color={btnText === 'OPEN' ? theme.primaryContainer : theme.onPrimary} 
                        style={{ marginRight: 6 }} 
                    />
                    <Text style={[
                        styles.primaryActionBtnText,
                        btnText === 'OPEN' && styles.openActionBtnText,
                        btnText === 'UPDATE' && styles.updateActionBtnText
                    ]}>
                        {btnText === 'OPEN' ? 'Open App' : btnText === 'UPDATE' ? 'Update' : 'Get / Install'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.secondaryActionBtn} 
                    activeOpacity={0.7} 
                    onPress={() => onPress(app)}
                >
                    <Text style={styles.secondaryActionBtnText}>Details</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 14,
        borderRadius: 20,
        backgroundColor: theme.surfaceContainer,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: theme.isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: theme.isDark ? 4 : 2,
    },
    topSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 15,
        backgroundColor: theme.surfaceVariant,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.cardBorder,
    },
    icon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    info: {
        flex: 1,
        marginLeft: 14,
        marginRight: 6,
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.onSurface,
        letterSpacing: -0.3,
    },
    desc: {
        fontSize: 13,
        color: theme.onSurfaceVariant,
        marginTop: 3,
        lineHeight: 18,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    updateStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    updateStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.primary,
    },
    installedStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    installedStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.primaryContainer,
    },
    versionText: {
        fontSize: 12,
        color: theme.tertiary,
    },
    newTag: {
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.3)',
    },
    newTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: theme.primaryContainer,
        letterSpacing: 0.5,
    },
    popularTag: {
        backgroundColor: 'rgba(255, 159, 10, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.3)',
    },
    popularTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FF9F0A',
        letterSpacing: 0.5,
    },
    moreBtn: {
        padding: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    primaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: theme.primary,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.onPrimary,
        letterSpacing: 0.2,
    },
    updateActionBtn: {
        backgroundColor: theme.primary,
    },
    updateActionBtnText: {
        color: theme.onPrimary,
    },
    openActionBtn: {
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.3)',
    },
    openActionBtnText: {
        color: theme.primaryContainer,
    },
    secondaryActionBtn: {
        flex: 1,
        backgroundColor: theme.surfaceContainerHigh,
        borderWidth: 1,
        borderColor: theme.outlineVariant,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.onSurface,
        letterSpacing: 0.2,
    },
});
