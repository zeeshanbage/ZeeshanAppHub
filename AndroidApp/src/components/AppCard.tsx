import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModel } from '../config/supabase';

interface AppCardProps {
    app: AppModel;
    onPress: (app: AppModel) => void;
}

export const AppCard: React.FC<AppCardProps> = ({ app, onPress }) => {
    return (
        <TouchableOpacity style={styles.cardContainer} activeOpacity={0.8} onPress={() => onPress(app)}>
            <View style={styles.iconContainer}>
                <Image source={{ uri: app.icon_url }} style={styles.appIcon} />
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                <Text style={styles.appVersion}>Version {app.version}</Text>
            </View>

            <View style={styles.actionContainer}>
                <View style={styles.downloadButton}>
                    <Icon name="cloud-download-outline" size={24} color="#FFF" />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 16,
        marginVertical: 8,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    appIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    appName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    appVersion: {
        fontSize: 14,
        fontWeight: '500',
        color: '#A0AEC0',
    },
    actionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 12,
    },
    downloadButton: {
        backgroundColor: '#00B4D8', // Electric Blue
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00B4D8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
});
