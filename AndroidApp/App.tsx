import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  StatusBar,
  RefreshControl,
  Dimensions,
  Animated,
  Easing,
  LogBox,
  Alert,
  Share,
  Modal,
  TouchableOpacity as RNTouchableOpacity,
  useColorScheme,
} from 'react-native';

LogBox.ignoreLogs([
    'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);
import { fetchApps, AppModel } from './src/config/supabase';
import { AppCard } from './src/components/AppCard';
import { AppDetailsPopup } from './src/components/AppDetailsPopup';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { AppCheckService, getFallbackPackageName, isUpdateRequired } from './src/services/AppCheckService';
import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { trackInstall, logFatalCrash } from './src/config/telemetry';
import { ThemeContext, DarkTheme, LightTheme, ThemeColors } from './src/theme/ThemeContext';

// Handle JS Crashes
const globalErrorHandler = (error: any, isFatal?: boolean) => {
  const errorString = error instanceof Error 
    ? `${error.name}: ${error.message}\n${error.stack}` 
    : String(error);
    
  logFatalCrash(errorString, isFatal ?? true);
  
  if (isFatal) {
    Alert.alert(
      'Unexpected Error',
      'The App Hub encountered a critical error.',
      [{ text: 'Close' }]
    );
  }
};

const globalAny = globalThis as any;
if (globalAny.ErrorUtils) {
  const previousHandler = globalAny.ErrorUtils.getGlobalHandler();
  globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    globalErrorHandler(error, isFatal);
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

const { width, height } = Dimensions.get('window');

// --- Skeleton Card Component ---
const SkeletonCard = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const styles = getSkeletonStyles(theme);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.iconBox, { opacity }]} />
      <View style={styles.textArea}>
        <Animated.View style={[styles.lineWide, { opacity }]} />
        <Animated.View style={[styles.lineNarrow, { opacity }]} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <Animated.View style={[styles.pill, { opacity }]} />
        </View>
      </View>
    </View>
  );
};

const SkeletonList = ({ theme }: { theme: ThemeColors }) => {
  const styles = getSkeletonStyles(theme);
  return (
    <View style={{ paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 56 }}>
      <View style={styles.header}>
        <View style={[styles.lineWide, { width: 180, height: 28 }]} />
      </View>
      {[0, 1, 2, 3].map(i => <SkeletonCard key={i} theme={theme} />)}
    </View>
  );
};

function App(): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const theme = systemColorScheme === 'light' ? LightTheme : DarkTheme;
  const styles = getStyles(theme);

  const [apps, setApps] = useState<AppModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppModel | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'downloads'>('recent');

  const loadApps = async () => {
    try {
      const rawData = await fetchApps();
      const nowTime = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      const appsWithMetrics = rawData.map((app, index) => {
        const download_count = (app.download_count !== undefined && app.download_count !== null)
          ? app.download_count
          : (index === 0 ? 120 : (index === 1 ? 15 : 5));

        const created_at = app.created_at
          ? app.created_at
          : (index === 1 ? new Date(nowTime - 1 * 24 * 60 * 60 * 1000).toISOString() : new Date(nowTime - 10 * 24 * 60 * 60 * 1000).toISOString());

        return {
          ...app,
          download_count,
          created_at
        };
      });

      let maxDownloads = 0;
      appsWithMetrics.forEach(app => {
        const count = app.download_count || 0;
        if (count > maxDownloads) {
          maxDownloads = count;
        }
      });

      const processedData = await Promise.all(appsWithMetrics.map(async (app) => {
        let tag: 'NEW' | 'MOST DOWNLOADED' | null = null;
        
        if (app.download_count && app.download_count === maxDownloads && maxDownloads > 0) {
          tag = 'MOST DOWNLOADED';
        } else if (app.created_at) {
          const createdTime = new Date(app.created_at).getTime();
          if ((nowTime - createdTime) < sevenDaysMs) {
            tag = 'NEW';
          }
        }

        const pkgName = app.package_name || getFallbackPackageName(app.name);
        const info = await AppCheckService.getAppInfo(pkgName);

        return { 
          ...app, 
          tag,
          isInstalled: info.isInstalled,
          isUpdateAvailable: isUpdateRequired(info.versionName, app.version)
        };
      }));

      // Sort: Installed apps on top, updates prioritized on top of those
      const sortedData = processedData.sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'downloads') {
          return (b.download_count || 0) - (a.download_count || 0);
        }
        if (a.isInstalled && !b.isInstalled) return -1;
        if (!a.isInstalled && b.isInstalled) return 1;
        if (a.isInstalled && b.isInstalled) {
          if (a.isUpdateAvailable && !b.isUpdateAvailable) return -1;
          if (!a.isUpdateAvailable && b.isUpdateAvailable) return 1;
        }
        return 0;
      });

      setApps(sortedData);
    } catch (error) {
      console.error('loadApps error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    trackInstall();
    loadApps();

    const requestPermissions = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const authStatus = await messaging().requestPermission();
      if (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      ) {
        messaging().subscribeToTopic('new_releases')
          .catch(e => console.log('Topic subscription error:', e));
      }
    };
    requestPermissions();

    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage.data?.appId) {
        setTimeout(() => {
           setApps(currentApps => {
               const targetApp = currentApps.find(a => a.id === remoteMessage.data!.appId);
               if (targetApp) {
                 setSelectedApp(targetApp);
                 setPopupVisible(true);
               }
               return currentApps;
           });
        }, 500);
      }
    });

    return () => unsubscribe();
  }, [sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadApps();
  };

  const handleAppPress = (app: AppModel) => {
    setSelectedApp(app);
    setPopupVisible(true);
  };

  const closePopup = () => {
    setPopupVisible(false);
    setTimeout(() => setSelectedApp(null), 350);
    loadApps();
  };

  const updateCount = apps.filter(a => (a as any).isUpdateAvailable).length;

  const renderHeader = () => (
    <View style={styles.header}>
      {/* TopAppBar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.menuIconBtn}>
            <Icon name="view-grid-outline" size={24} color={theme.primary} />
          </View>
          <Text style={styles.title}>Zeeshan's App Hub</Text>
        </View>
        <View style={styles.avatarPill}>
          <Text style={styles.avatarText}>Z</Text>
        </View>
      </View>

      {/* Controls & Status Bar (Sort by, Storage, Update All) */}
      <View style={styles.controlsSection}>
        <View style={styles.sortPill}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <RNTouchableOpacity 
            style={styles.sortBtn}
            onPress={() => {
              setSortBy(prev => prev === 'recent' ? 'name' : prev === 'name' ? 'downloads' : 'recent');
            }}
          >
            <Text style={styles.sortValueText}>
              {sortBy === 'recent' ? 'Last Used' : sortBy === 'name' ? 'Name (A-Z)' : 'Popularity'}
            </Text>
            <Icon name="chevron-down" size={16} color={theme.onSurface} />
          </RNTouchableOpacity>
        </View>

        <View style={styles.controlButtons}>
          <RNTouchableOpacity 
            style={styles.controlBtnSecondary}
            onPress={onRefresh}
          >
            <Icon name="database-outline" size={16} color={theme.onSurface} style={{ marginRight: 5 }} />
            <Text style={styles.controlBtnSecondaryText}>{apps.length} Apps</Text>
          </RNTouchableOpacity>

          {updateCount > 0 && (
            <RNTouchableOpacity 
              style={styles.controlBtnPrimary}
              onPress={() => {
                const firstUpdate = apps.find(a => (a as any).isUpdateAvailable);
                if (firstUpdate) handleAppPress(firstUpdate);
              }}
            >
              <Icon name="update" size={16} color={theme.onPrimary} style={{ marginRight: 4 }} />
              <Text style={styles.controlBtnPrimaryText}>Update ({updateCount})</Text>
            </RNTouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <ThemeContext.Provider value={theme}>
      <View style={styles.container}>
        <StatusBar 
          barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.surface} 
          translucent 
        />

        {loading && !refreshing ? (
          <SkeletonList theme={theme} />
        ) : (
          <FlatList
            data={apps}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AppCard app={item} onPress={handleAppPress} />}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
                progressBackgroundColor={theme.surfaceContainerHigh}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon name="book-open-page-variant" size={48} color={theme.outline} />
                <Text style={styles.emptyTitle}>No apps found</Text>
                <Text style={styles.emptyDesc}>Add applications from your admin portal.</Text>
              </View>
            }
          />
        )}

        <AppDetailsPopup
          app={selectedApp}
          visible={popupVisible}
          onClose={closePopup}
        />
      </View>
    </ThemeContext.Provider>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  listContent: {
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 48,
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.12)' : 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.onSurface,
    letterSpacing: -0.4,
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceContainer,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  sortLabel: {
    fontSize: 13,
    color: theme.onSurfaceVariant,
    marginRight: 6,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primary,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  controlBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.onSurface,
  },
  controlBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  controlBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.12,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.onSurface,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: theme.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const getSkeletonStyles = (theme: ThemeColors) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: theme.surfaceContainer,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 15,
    backgroundColor: theme.surfaceVariant,
  },
  textArea: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  lineWide: {
    height: 16,
    width: '60%',
    backgroundColor: theme.surfaceVariant,
    borderRadius: 4,
    marginBottom: 8,
  },
  lineNarrow: {
    height: 12,
    width: '85%',
    backgroundColor: theme.surfaceVariant,
    borderRadius: 4,
  },
  pill: {
    height: 16,
    width: 60,
    backgroundColor: theme.surfaceVariant,
    borderRadius: 4,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
});

export default App;
