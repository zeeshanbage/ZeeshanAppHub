import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemeColors } from '../../theme/ThemeContext';
import { createAppRecord } from '../../services/adminService';

interface AdminAddAppViewProps {
  theme: ThemeColors;
  onAppCreated: () => void;
}

export const AdminAddAppView: React.FC<AdminAddAppViewProps> = ({
  theme,
  onAppCreated,
}) => {
  const [form, setForm] = useState({
    name: '',
    version: '',
    package_name: '',
    description: '',
    apk_url: '',
    icon_url: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.version.trim() || !form.apk_url.trim()) {
      setErrorMsg('App Name, Version, and APK Download URL are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await createAppRecord({
      name: form.name,
      version: form.version,
      package_name: form.package_name || `com.zeeshan.${form.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      description: form.description || 'Initial release.',
      apk_url: form.apk_url,
      icon_url: form.icon_url || undefined,
    });

    setLoading(false);

    if (res.success) {
      Alert.alert(
        'App Published! 🚀',
        `"${form.name}" (v${form.version}) has been added to Supabase and is now visible in the catalog!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setForm({
                name: '',
                version: '',
                package_name: '',
                description: '',
                apk_url: '',
                icon_url: '',
              });
              onAppCreated();
            },
          },
        ]
      );
    } else {
      setErrorMsg(res.error || 'Failed to publish application to Supabase.');
    }
  };

  const styles = getStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Icon name="cloud-upload-outline" size={28} color={theme.primary} />
        </View>
        <Text style={styles.title}>Add New Application</Text>
        <Text style={styles.subtitle}>
          Publish an APK directly to your Hub database. It will immediately appear in the user store.
        </Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={18} color={theme.error} style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Application Name *</Text>
        <TextInput
          style={styles.inputField}
          placeholder="e.g. My NextGen Tool"
          placeholderTextColor={theme.onSurfaceVariant}
          value={form.name}
          onChangeText={(t) => {
            setForm((f) => ({ ...f, name: t }));
            setErrorMsg(null);
          }}
        />

        <Text style={styles.fieldLabel}>Version *</Text>
        <TextInput
          style={styles.inputField}
          placeholder="e.g. 1.0.0"
          placeholderTextColor={theme.onSurfaceVariant}
          value={form.version}
          onChangeText={(t) => {
            setForm((f) => ({ ...f, version: t }));
            setErrorMsg(null);
          }}
        />

        <Text style={styles.fieldLabel}>Package Name (Android Identifier)</Text>
        <TextInput
          style={styles.inputField}
          placeholder="e.g. com.example.myapp (optional)"
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="none"
          value={form.package_name}
          onChangeText={(t) => setForm((f) => ({ ...f, package_name: t }))}
        />

        <Text style={styles.fieldLabel}>APK Download URL *</Text>
        <TextInput
          style={styles.inputField}
          placeholder="https://pub-xxx.r2.dev/apks/...apk"
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="none"
          value={form.apk_url}
          onChangeText={(t) => {
            setForm((f) => ({ ...f, apk_url: t }));
            setErrorMsg(null);
          }}
        />
        <Text style={styles.hintText}>
          Cloudflare R2, Supabase Storage, or GitHub release direct download link.
        </Text>

        <Text style={styles.fieldLabel}>Icon Image URL (Optional)</Text>
        <TextInput
          style={styles.inputField}
          placeholder="https://.../icon.png"
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="none"
          value={form.icon_url}
          onChangeText={(t) => setForm((f) => ({ ...f, icon_url: t }))}
        />
        <Text style={styles.hintText}>
          Direct link to PNG/WebP icon. A default icon will be used if left blank.
        </Text>

        <Text style={styles.fieldLabel}>Description & Release Notes</Text>
        <TextInput
          style={[styles.inputField, { height: 90, textAlignVertical: 'top' }]}
          placeholder="Tell users what features this application offers..."
          placeholderTextColor={theme.onSurfaceVariant}
          multiline
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Icon name="rocket-launch-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Publish Application</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    header: {
      alignItems: 'center',
      marginBottom: 20,
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.onSurface,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: theme.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 16,
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
    card: {
      backgroundColor: theme.surfaceContainer,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.onSurface,
      marginBottom: 6,
      marginTop: 12,
    },
    inputField: {
      backgroundColor: theme.surfaceContainerHigh,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.outlineVariant,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: theme.onSurface,
      fontSize: 14,
    },
    hintText: {
      fontSize: 11,
      color: theme.onSurfaceVariant,
      marginTop: 4,
      marginBottom: 4,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 14,
      height: 50,
      marginTop: 24,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
