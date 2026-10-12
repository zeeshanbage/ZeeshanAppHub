import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemeColors } from '../../theme/ThemeContext';
import { adminSignIn, adminSignUp } from '../../services/adminService';

interface AdminLoginViewProps {
  theme: ThemeColors;
  onLoginSuccess: (user: any) => void;
  onClose: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  theme,
  onLoginSuccess,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    if (isSignUp) {
      const res = await adminSignUp(email, password);
      setLoading(false);
      if (res.success) {
        if (res.user && !res.session) {
          setInfoMsg('Admin registered! If email confirmation is enabled, check your inbox or approve in Supabase.');
        } else if (res.user) {
          onLoginSuccess(res.user);
        }
      } else {
        setErrorMsg(res.error || 'Failed to create user in Supabase.');
      }
    } else {
      const res = await adminSignIn(email, password);
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.error || 'Invalid credentials. User is managed from Supabase.');
      }
    }
  };

  const styles = getStyles(theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Dismiss Button */}
        <View style={styles.topHeader}>
          <View style={styles.badge}>
            <Icon name="shield-lock" size={16} color={theme.primary} />
            <Text style={styles.badgeText}>Supabase Auth Protected</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Title & Description */}
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Icon name="account-cog" size={36} color={theme.primary} />
          </View>
          <Text style={styles.title}>Admin Portal</Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Register a new admin account managed via your Supabase database.'
              : 'Sign in with your Supabase admin credentials to manage apps & telemetry.'}
          </Text>
        </View>

        {/* Error / Info messages */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color={theme.error} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {infoMsg ? (
          <View style={styles.infoBox}>
            <Icon name="check-circle-outline" size={18} color="#30D158" style={{ marginRight: 6 }} />
            <Text style={styles.infoText}>{infoMsg}</Text>
          </View>
        ) : null}

        {/* Form Inputs */}
        <View style={styles.form}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <Icon name="email-outline" size={20} color={theme.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="admin@example.com"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrorMsg('');
              }}
            />
          </View>

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Password</Text>
          <View style={styles.inputWrapper}>
            <Icon name="lock-outline" size={20} color={theme.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="••••••••"
              placeholderTextColor={theme.onSurfaceVariant}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrorMsg('');
              }}
            />
            <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Icon name={isSignUp ? 'account-plus' : 'login'} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>
                  {isSignUp ? 'Create Admin Account' : 'Sign In as Admin'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Toggle Sign In / Sign Up */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => {
              setIsSignUp((s) => !s);
              setErrorMsg('');
              setInfoMsg('');
            }}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an admin account? ' : 'First time setup? '}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Sign In' : 'Register Admin User'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Supabase Help Note */}
        <View style={styles.noteBox}>
          <Icon name="database-outline" size={16} color={theme.onSurfaceVariant} style={{ marginRight: 6 }} />
          <Text style={styles.noteText}>
            Users are managed directly in your Supabase Auth dashboard under Authentication → Users.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 40,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 6,
    },
    badgeText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.surfaceContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.onSurface,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 20,
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
      fontWeight: '500',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(48, 209, 88, 0.12)' : 'rgba(52, 199, 89, 0.1)',
      borderColor: '#30D158',
      borderWidth: 1,
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    infoText: {
      color: '#30D158',
      fontSize: 13,
      flex: 1,
      fontWeight: '500',
    },
    form: {
      backgroundColor: theme.surfaceContainer,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.onSurface,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceContainerHigh,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.outlineVariant,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      color: theme.onSurface,
      fontSize: 15,
      height: '100%',
    },
    eyeBtn: {
      padding: 4,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 14,
      height: 50,
      marginTop: 20,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    toggleRow: {
      marginTop: 16,
      alignItems: 'center',
    },
    toggleText: {
      color: theme.onSurfaceVariant,
      fontSize: 13,
    },
    toggleTextBold: {
      color: theme.primary,
      fontWeight: '700',
    },
    noteBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceContainer,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    noteText: {
      color: theme.onSurfaceVariant,
      fontSize: 12,
      flex: 1,
      lineHeight: 16,
    },
  });
