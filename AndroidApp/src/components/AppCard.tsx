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
        <TouchableOpacity style={styles.cardContainer} activeOpacity={0.7} onPress={() => onPress(app)}>
            <View style={styles.backgroundGlow} />
            <View style={styles.contentContainer}>
                <View style={styles.iconContainer}>
                    <Image source={{ uri: app.icon_url }} style={styles.appIcon} />
                </View>

                <View style={styles.infoContainer}>
                    <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                    <View style={styles.versionBadge}>
                        <Text style={styles.appVersion}>v{app.version}</Text>
                    </View>
                </View>

                <View style={styles.actionContainer}>
                    <View style={styles.downloadButton}>
                        <Icon name="download" size={20} color="#0B132B" />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        position: 'relative',
        marginVertical: 10,
        marginHorizontal: 20,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    backgroundGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 180, 216, 0.02)',
        borderRadius: 24,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    appIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 18,
        justifyContent: 'center',
    },
    appName: {
        fontSize: 19,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    versionBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0, 180, 216, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 180, 216, 0.3)',
    },
    appVersion: {
        fontSize: 12,
        fontWeight: '700',
        color: '#00B4D8',
        letterSpacing: 0.5,
    },
    actionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 12,
    },
    downloadButton: {
        backgroundColor: '#00B4D8',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 8,
    },
});
