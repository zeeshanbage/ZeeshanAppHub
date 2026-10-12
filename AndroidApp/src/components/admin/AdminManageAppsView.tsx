import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemeColors } from '../../theme/ThemeContext';
import { fetchApps, AppModel } from '../../config/supabase';
import { updateAppDetails, deleteAppRecord } from '../../services/adminService';

interface AdminManageAppsViewProps {
  theme: ThemeColors;
  onAppListChanged: () => void;
}

export const AdminManageAppsView: React.FC<AdminManageAppsViewProps> = ({
  theme,
  onAppListChanged,
}) => {
  const [apps, setApps] = useState<AppModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingApp, setEditingApp] = useState<AppModel | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    description: '',
    package_name: '',
    apk_url: '',
    icon_url: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadAppsList = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchApps();
      setApps(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch apps');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAppsList();
  }, [loadAppsList]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAppsList();
  };

  const handleOpenEdit = (app: AppModel) => {
    setEditingApp(app);
    setEditForm({
      name: app.name,
      version: app.version,
      description: app.description || '',
      package_name: app.package_name || '',
      apk_url: app.apk_url || '',
      icon_url: app.icon_url || '',
    });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    if (!editForm.name.trim() || !editForm.version.trim()) {
      setEditError('Name and Version are required.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    const res = await updateAppDetails(editingApp.id, editForm);
    setSavingEdit(false);

    if (res.success) {
      setEditingApp(null);
      loadAppsList();
      onAppListChanged();
      Alert.alert('Success', 'Application updated successfully.');
    } else {
      setEditError(res.error || 'Failed to update application');
    }
  };

  const handleDelete = (app: AppModel) => {
    Alert.alert(
      'Delete Application',
      `Are you sure you want to permanently delete "${app.name}" (v${app.version})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await deleteAppRecord(app.id);
            if (res.success) {
              loadAppsList();
              onAppListChanged();
              Alert.alert('Deleted', `"${app.name}" has been removed.`);
            } else {
              setLoading(false);
              Alert.alert('Error', res.error || 'Failed to delete app');
            }
          },
        },
      ]
    );
  };

  const styles = getStyles(theme);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {/* Header Info */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.headerTitle}>All Applications ({apps.length})</Text>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
          <Icon name="refresh" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={18} color={theme.error} style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Apps List */}
      <View style={styles.appsList}>
        {apps.map((app) => (
          <View key={app.id} style={styles.appCard}>
            <View style={styles.appCardTop}>
              <Image
                source={{
                  uri: app.icon_url || 'https://cdn-icons-png.flaticon.com/512/2880/2880661.png',
                }}
                style={styles.appIcon}
              />
              <View style={styles.appInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.appName} numberOfLines={1}>
                    {app.name}
                  </Text>
                  <View style={styles.versionPill}>
                    <Text style={styles.versionText}>v{app.version}</Text>
                  </View>
                </View>

                <Text style={styles.pkgText} numberOfLines={1}>
                  {app.package_name || 'No package ID'}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Icon name="download-outline" size={13} color={theme.onSurfaceVariant} />
                    <Text style={styles.metaText}>{app.download_count || 0} downloads</Text>
                  </View>
                  {app.created_at && (
                    <View style={styles.metaItem}>
                      <Icon name="calendar-clock-outline" size={13} color={theme.onSurfaceVariant} />
                      <Text style={styles.metaText}>
                        {new Date(app.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Description Preview */}
            {app.description ? (
              <Text style={styles.descPreview} numberOfLines={2}>
                {app.description}
              </Text>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => handleOpenEdit(app)}
              >
                <Icon name="pencil-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
                <Text style={styles.editBtnText}>Edit Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(app)}
              >
                <Icon name="trash-can-outline" size={16} color={theme.error} style={{ marginRight: 4 }} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={!!editingApp}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingApp(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="application-edit" size={22} color={theme.primary} />
                <Text style={styles.modalTitle}>Edit Application</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingApp(null)} style={styles.modalCloseBtn}>
                <Icon name="close" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {editError && (
              <View style={[styles.errorBox, { marginHorizontal: 16, marginTop: 8 }]}>
                <Icon name="alert-circle" size={16} color={theme.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{editError}</Text>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.modalFormContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>App Name *</Text>
              <TextInput
                style={styles.inputField}
                value={editForm.name}
                onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))}
                placeholder="My App"
                placeholderTextColor={theme.onSurfaceVariant}
              />

              <Text style={styles.fieldLabel}>Version *</Text>
              <TextInput
                style={styles.inputField}
                value={editForm.version}
                onChangeText={(t) => setEditForm((f) => ({ ...f, version: t }))}
                placeholder="1.0.0"
                placeholderTextColor={theme.onSurfaceVariant}
              />

              <Text style={styles.fieldLabel}>Package Name</Text>
              <TextInput
                style={styles.inputField}
                value={editForm.package_name}
                onChangeText={(t) => setEditForm((f) => ({ ...f, package_name: t }))}
                placeholder="com.example.app"
                placeholderTextColor={theme.onSurfaceVariant}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Description / Changelog</Text>
              <TextInput
                style={[styles.inputField, { height: 90, textAlignVertical: 'top' }]}
                value={editForm.description}
                onChangeText={(t) => setEditForm((f) => ({ ...f, description: t }))}
                placeholder="What's new in this version..."
                placeholderTextColor={theme.onSurfaceVariant}
                multiline
              />

              <Text style={styles.fieldLabel}>APK Download URL</Text>
              <TextInput
                style={styles.inputField}
                value={editForm.apk_url}
                onChangeText={(t) => setEditForm((f) => ({ ...f, apk_url: t }))}
                placeholder="https://..."
                placeholderTextColor={theme.onSurfaceVariant}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Icon URL</Text>
              <TextInput
                style={styles.inputField}
                value={editForm.icon_url}
                onChangeText={(t) => setEditForm((f) => ({ ...f, icon_url: t }))}
                placeholder="https://..."
                placeholderTextColor={theme.onSurfaceVariant}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingEdit && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Icon name="content-save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 40,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      color: theme.onSurfaceVariant,
      fontSize: 14,
      marginTop: 12,
    },
    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.onSurface,
    },
    refreshIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.surfaceContainer,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(255, 69, 58, 0.12)' : 'rgba(255, 59, 48, 0.1)',
      borderColor: theme.error,
      borderWidth: 1,
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    errorText: {
      color: theme.error,
      fontSize: 13,
      flex: 1,
    },
    appsList: {
      gap: 14,
    },
    appCard: {
      backgroundColor: theme.surfaceContainer,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    appCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    appIcon: {
      width: 54,
      height: 54,
      borderRadius: 14,
      backgroundColor: theme.surfaceVariant,
      marginRight: 12,
    },
    appInfo: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    appName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.onSurface,
      flex: 1,
    },
    versionPill: {
      backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    versionText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    pkgText: {
      fontSize: 12,
      color: theme.onSurfaceVariant,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 6,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      color: theme.onSurfaceVariant,
    },
    descPreview: {
      fontSize: 13,
      color: theme.onSurfaceVariant,
      lineHeight: 18,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.outlineVariant,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.outlineVariant,
    },
    editBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceContainerHigh,
      borderRadius: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    editBtnText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255, 69, 58, 0.12)' : 'rgba(255, 59, 48, 0.1)',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    deleteBtnText: {
      color: theme.error,
      fontSize: 13,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.onSurface,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalFormContent: {
      padding: 20,
      paddingBottom: 40,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.onSurface,
      marginBottom: 6,
      marginTop: 12,
    },
    inputField: {
      backgroundColor: theme.surfaceContainer,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: theme.onSurface,
      fontSize: 14,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 14,
      height: 48,
      marginTop: 24,
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
