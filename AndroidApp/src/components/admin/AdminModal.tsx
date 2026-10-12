import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../theme/ThemeContext';
import { AdminLoginView } from './AdminLoginView';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminManageAppsView } from './AdminManageAppsView';
import { AdminAddAppView } from './AdminAddAppView';
import { adminSignOut, getAdminSession } from '../../services/adminService';

interface AdminModalProps {
  visible: boolean;
  onClose: () => void;
  onAppListChanged: () => void;
}

type AdminTab = 'dashboard' | 'manage' | 'add';

export const AdminModal: React.FC<AdminModalProps> = ({
  visible,
  onClose,
  onAppListChanged,
}) => {
  const theme = useTheme();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    if (visible) {
      getAdminSession().then((session) => {
        if (session?.user) {
          setCurrentUser(session.user);
        } else {
          setCurrentUser(null);
        }
      });
    }
  }, [visible]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the Admin portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await adminSignOut();
          setCurrentUser(null);
        },
      },
    ]);
  };

  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.surface}
        />

        {!currentUser ? (
          <AdminLoginView
            theme={theme}
            onLoginSuccess={(user) => setCurrentUser(user)}
            onClose={onClose}
          />
        ) : (
          <View style={styles.container}>
            {/* Admin Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoText}>Z</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>App Hub Admin</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {currentUser.email || 'Admin'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={handleLogout}
                  accessibilityLabel="Sign out"
                >
                  <Icon name="logout-variant" size={20} color={theme.error} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeIconBtn}
                  onPress={onClose}
                  accessibilityLabel="Close"
                >
                  <Icon name="close" size={20} color={theme.onSurface} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'dashboard' && styles.tabBtnActive]}
                onPress={() => setActiveTab('dashboard')}
              >
                <Icon
                  name="chart-timeline-variant"
                  size={18}
                  color={activeTab === 'dashboard' ? '#FFFFFF' : theme.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === 'dashboard' && styles.tabBtnTextActive,
                  ]}
                >
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'manage' && styles.tabBtnActive]}
                onPress={() => setActiveTab('manage')}
              >
                <Icon
                  name="format-list-checks"
                  size={18}
                  color={activeTab === 'manage' ? '#FFFFFF' : theme.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === 'manage' && styles.tabBtnTextActive,
                  ]}
                >
                  Manage Apps
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'add' && styles.tabBtnActive]}
                onPress={() => setActiveTab('add')}
              >
                <Icon
                  name="cloud-upload-outline"
                  size={18}
                  color={activeTab === 'add' ? '#FFFFFF' : theme.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === 'add' && styles.tabBtnTextActive,
                  ]}
                >
                  Add App
                </Text>
              </TouchableOpacity>
            </View>

            {/* Active Tab Screen */}
            <View style={styles.tabContent}>
              {activeTab === 'dashboard' && <AdminDashboardView theme={theme} />}
              {activeTab === 'manage' && (
                <AdminManageAppsView
                  theme={theme}
                  onAppListChanged={onAppListChanged}
                />
              )}
              {activeTab === 'add' && (
                <AdminAddAppView
                  theme={theme}
                  onAppCreated={() => {
                    onAppListChanged();
                    setActiveTab('manage');
                  }}
                />
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    logoBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.onSurface,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.onSurfaceVariant,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.isDark ? 'rgba(255, 69, 58, 0.12)' : 'rgba(255, 59, 48, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceContainer,
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 10,
    },
    tabBtnActive: {
      backgroundColor: theme.primary,
    },
    tabBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.onSurfaceVariant,
    },
    tabBtnTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    tabContent: {
      flex: 1,
    },
  });
