import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemeColors } from '../../theme/ThemeContext';
import { fetchTelemetryStats, TelemetryData, InstallRecord, IssueRecord } from '../../services/adminService';

interface AdminDashboardViewProps {
  theme: ThemeColors;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ theme }) => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'installs' | 'issues'>('installs');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setError(null);
    const res = await fetchTelemetryStats();
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Failed to load telemetry stats');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const styles = getStyles(theme);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading Telemetry Data...</Text>
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
      {/* Metric Stat Cards */}
      <View style={styles.metricRow}>
        {/* Total Installs Card */}
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <View style={[styles.statIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
              <Icon name="cellphone-arrow-down" size={20} color={theme.primary} />
            </View>
            <Text style={styles.statLabel}>Total Installs</Text>
          </View>
          <Text style={styles.statNumber}>{data?.installCount || 0}</Text>
          <Text style={styles.statSubText}>Active across all devices</Text>
        </View>

        {/* Total Issues Card */}
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <View style={[styles.statIconBadge, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
              <Icon name="alert-circle-outline" size={20} color={theme.error} />
            </View>
            <Text style={[styles.statLabel, { color: theme.error }]}>Issues Logged</Text>
          </View>
          <Text style={[styles.statNumber, { color: theme.error }]}>{data?.issueCount || 0}</Text>
          <Text style={styles.statSubText}>Crash reports & errors</Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={18} color={theme.error} style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Sub Tabs: Active Installs vs Crash Reports */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSubTab === 'installs' && styles.segmentBtnActive]}
          onPress={() => setActiveSubTab('installs')}
        >
          <Icon
            name="devices"
            size={16}
            color={activeSubTab === 'installs' ? '#FFFFFF' : theme.onSurfaceVariant}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.segmentText,
              activeSubTab === 'installs' && styles.segmentTextActive,
            ]}
          >
            Active Devices ({data?.latestInstalls?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSubTab === 'issues' && styles.segmentBtnActive]}
          onPress={() => setActiveSubTab('issues')}
        >
          <Icon
            name="bug-outline"
            size={16}
            color={activeSubTab === 'issues' ? '#FFFFFF' : theme.onSurfaceVariant}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.segmentText,
              activeSubTab === 'issues' && styles.segmentTextActive,
            ]}
          >
            Crash Logs ({data?.latestIssues?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeSubTab === 'installs' ? (
        <View style={styles.listSection}>
          {data?.latestInstalls && data.latestInstalls.length > 0 ? (
            data.latestInstalls.map((item: InstallRecord) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Icon name="cellphone" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.deviceTitle}>
                      {item.brand} {item.model || 'Unknown Device'}
                    </Text>
                  </View>
                  <View style={styles.osBadge}>
                    <Text style={styles.osBadgeText}>Android {item.system_version}</Text>
                  </View>
                </View>

                <View style={styles.itemDetailsGrid}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>DEVICE ID</Text>
                    <Text style={styles.detailVal}>
                      {item.device_id ? `${item.device_id.substring(0, 10)}...` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>INSTALLED</Text>
                    <Text style={styles.detailVal}>
                      {item.installed_at ? new Date(item.installed_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>LAST OPENED</Text>
                    <Text style={styles.detailVal}>
                      {item.last_opened ? new Date(item.last_opened).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="devices" size={32} color={theme.outline} />
              <Text style={styles.emptyTitle}>No installs tracked yet</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.listSection}>
          {data?.latestIssues && data.latestIssues.length > 0 ? (
            data.latestIssues.map((issue: IssueRecord) => {
              const isExpanded = expandedIssueId === issue.id;
              return (
                <View key={issue.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={[styles.issueBadge, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
                      <Icon name="alert-decagram" size={14} color={theme.error} style={{ marginRight: 4 }} />
                      <Text style={[styles.issueBadgeText, { color: theme.error }]}>
                        {issue.error_message || 'Error'}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>
                      {issue.created_at ? new Date(issue.created_at).toLocaleString() : 'N/A'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                    style={styles.stackTraceBox}
                  >
                    <Text
                      numberOfLines={isExpanded ? undefined : 3}
                      style={styles.stackTraceText}
                    >
                      {issue.stack_trace || 'No stack trace available.'}
                    </Text>
                    <Text style={styles.expandText}>
                      {isExpanded ? 'Tap to collapse' : 'Tap to expand full trace'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.issueFooter}>
                    <Icon name="android" size={14} color={theme.onSurfaceVariant} style={{ marginRight: 4 }} />
                    <Text style={styles.footerInfoText}>
                      {issue.platform || 'Android'} • Device:{' '}
                      {issue.device_id ? `${issue.device_id.substring(0, 8)}...` : 'N/A'}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="check-circle-outline" size={36} color="#30D158" />
              <Text style={styles.emptyTitle}>No crash reports! Everything looks healthy.</Text>
            </View>
          )}
        </View>
      )}
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
    metricRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surfaceContainer,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    statCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    statIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statNumber: {
      fontSize: 32,
      fontWeight: '900',
      color: theme.onSurface,
      letterSpacing: -0.5,
    },
    statSubText: {
      fontSize: 11,
      color: theme.onSurfaceVariant,
      marginTop: 4,
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
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceContainer,
      borderRadius: 14,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.onSurfaceVariant,
    },
    segmentTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    listSection: {
      gap: 12,
    },
    itemCard: {
      backgroundColor: theme.surfaceContainer,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    deviceTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.onSurface,
    },
    osBadge: {
      backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    osBadgeText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    itemDetailsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.outlineVariant,
    },
    detailCol: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.onSurfaceVariant,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    detailVal: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.onSurface,
    },
    issueBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    issueBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    timeText: {
      fontSize: 11,
      color: theme.onSurfaceVariant,
    },
    stackTraceBox: {
      backgroundColor: theme.surfaceContainerLowest,
      borderRadius: 10,
      padding: 10,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    stackTraceText: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 11,
      color: theme.onSurfaceVariant,
      lineHeight: 16,
    },
    expandText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
      marginTop: 6,
    },
    issueFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    footerInfoText: {
      fontSize: 11,
      color: theme.onSurfaceVariant,
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: theme.surfaceContainer,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.onSurfaceVariant,
    },
  });
