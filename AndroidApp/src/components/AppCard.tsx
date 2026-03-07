import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';

interface AppCardProps {
    app: AppModel;
    onPress: (app: AppModel) => void;
}

const { width } = Dimensions.get('window');

export const AppCard: React.FC<AppCardProps> = ({ app, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPress(app)}>
            {/* Accent stripe */}
            <View style={styles.accentStripe} />

            <View style={styles.content}>
                {/* App Icon */}
                <View style={styles.iconShadow}>
                    <View style={styles.iconBox}>
                        <Image source={{ uri: app.icon_url }} style={styles.icon} />
                    </View>
                </View>

                {/* Info */}
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{app.name}</Text>
                    <Text style={styles.desc} numberOfLines={1}>{app.description}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.versionPill}>
                            <Text style={styles.versionText}>v{app.version}</Text>
                        </View>
                        <View style={styles.sizePill}>
                            <Icon name="android" size={11} color="#A78BFA" />
                            <Text style={styles.sizeText}>APK</Text>
                        </View>
                    </View>
                </View>

                {/* Get Button */}
                <TouchableOpacity style={styles.getBtn} activeOpacity={0.7} onPress={() => onPress(app)}>
                    <Text style={styles.getBtnText}>GET</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 20,
        marginBottom: 14,
        borderRadius: 20,
        backgroundColor: '#161B2E',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.08)',
        elevation: 6,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
    },
    accentStripe: {
        height: 3,
        backgroundColor: 'transparent',
        // This creates a visual gradient effect via a thin gradient line
        borderTopWidth: 1,
        borderTopColor: 'rgba(167, 139, 250, 0.2)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconShadow: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    iconBox: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: '#1E2440',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    icon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    info: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F1F5F9',
        letterSpacing: 0.2,
        marginBottom: 3,
    },
    desc: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 8,
        lineHeight: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    versionPill: {
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    versionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#38BDF8',
        letterSpacing: 0.3,
    },
    sizePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
    },
    sizeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#A78BFA',
    },
    getBtn: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    getBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
