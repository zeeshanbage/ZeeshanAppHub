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

// Handle JS Crashes
const globalErrorHandler = (error: any, isFatal?: boolean) => {
  const errorString = error instanceof Error 
    ? `${error.name}: ${error.message}\n${error.stack}` 
    : String(error);
    
  logFatalCrash(errorString, isFatal ?? true);
  
  if (isFatal) {
    Alert.alert(
      'Unexpected Error',
      'The App Hub encountered a critical error. Your crash log has been securely tracked, but you can also share it manually with the developer.',
      [
        {
          text: 'Share Log',
          onPress: () => {
             Share.share({ message: `Fatal App Crash Log:\n\n${errorString}` });
          }
        },
        {
          text: 'Close',
        }
      ]
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
const SkeletonCard = () => {
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

  return (
    <View style={skeletonStyles.card}>
      <Animated.View style={[skeletonStyles.iconBox, { opacity }]} />
      <View style={skeletonStyles.textArea}>
        <Animated.View style={[skeletonStyles.lineWide, { opacity }]} />
        <Animated.View style={[skeletonStyles.lineNarrow, { opacity }]} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <Animated.View style={[skeletonStyles.pill, { opacity }]} />
          <Animated.View style={[skeletonStyles.pill, { opacity, width: 50 }]} />
        </View>
      </View>
      <Animated.View style={[skeletonStyles.btn, { opacity }]} />
    </View>
  );
};

const SkeletonList = () => (
  <View style={{ paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 56 }}>
    {/* Skeleton header */}
    <View style={skeletonStyles.header}>
      <View>
        <View style={[skeletonStyles.lineNarrow, { width: 100, marginBottom: 8 }]} />
        <View style={[skeletonStyles.lineWide, { width: 160, height: 26 }]} />
      </View>
      <View style={skeletonStyles.avatarSkel} />
    </View>
    <View style={[skeletonStyles.lineNarrow, { width: 80, marginLeft: 22, marginBottom: 16 }]} />
    {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
  </View>
);

function App(): React.JSX.Element {
  const [apps, setApps] = useState<AppModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppModel | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);

  console.log('App component mounting. Current window dimensions:', Dimensions.get('window'));

  const loadApps = async () => {
    console.log('loadApps: Fetching apps...');
    try {
      const rawData = await fetchApps();
      console.log('loadApps: Successfully loaded apps. Count:', rawData.length);
      
      const nowTime = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // 1. Fill fallbacks if database columns don't exist yet
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

      // 2. Compute "MOST DOWNLOADED" threshold
      let maxDownloads = 0;
      appsWithMetrics.forEach(app => {
        const count = app.download_count || 0;
        if (count > maxDownloads) {
          maxDownloads = count;
        }
      });

      // 3. Assign tags and check installation status
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
      console.log('loadApps: Setting loading to false');
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
          .then(() => console.log('Subscribed to "new_releases" topic!'))
          .catch(e => console.log('Topic subscription error:', e));
      }
    };
    requestPermissions();

    // Handle tapping a notification when app is in background
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage.data?.appId) {
        // App id is passed from the admin server
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

    // Handle opening app from a cold state via notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage && remoteMessage.data?.appId) {
          setTimeout(() => {
             setApps(currentApps => {
                 const targetApp = currentApps.find(a => a.id === remoteMessage.data!.appId);
                 if (targetApp) {
                   setSelectedApp(targetApp);
                   setPopupVisible(true);
                 }
                 return currentApps;
             });
          }, 1000);
        }
      });

    return unsubscribe;
  }, []);

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
    // Refresh apps list to update sorting and status immediately
    loadApps();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.greeting}>Welcome back</Text>
            <Icon name="hand-wave" size={16} color="#FBBF24" />
          </View>
          <Text style={styles.title}>Zeeshan Hub</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>Z</Text>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Icon name="apps" size={18} color="#A78BFA" />
        <Text style={styles.sectionTitle}>Your Apps</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{apps.length}</Text>
        </View>
      </View>
    </View>
  );

  console.log('App rendering. state:', { loading, refreshing, appsCount: apps.length });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Layered background for depth */}
      <View style={styles.bgBase} />
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />
      <View style={styles.bgOrb3} />
      <View style={styles.bgTopStrip} />

      {loading && !refreshing ? (
        <SkeletonList />
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
              tintColor="#A78BFA"
              colors={['#7C3AED']}
              progressBackgroundColor="#161B2E"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Icon name="package-variant" size={48} color="rgba(167, 139, 250, 0.4)" />
              </View>
              <Text style={styles.emptyTitle}>No apps yet</Text>
              <Text style={styles.emptyDesc}>Upload your first app via the Admin Portal to see it here.</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B16',
  },
  // Multi-layer background
  bgBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#080B16',
  },
  bgOrb1: {
    position: 'absolute',
    top: -height * 0.12,
    left: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
  },
  bgOrb2: {
    position: 'absolute',
    top: height * 0.4,
    right: -width * 0.35,
    width: width,
    height: width,
    borderRadius: width * 0.5,
    backgroundColor: 'rgba(56, 189, 248, 0.035)',
  },
  bgOrb3: {
    position: 'absolute',
    bottom: -height * 0.15,
    left: -width * 0.1,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(167, 139, 250, 0.03)',
  },
  bgTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StatusBar.currentHeight ? StatusBar.currentHeight + 80 : 120,
    backgroundColor: 'rgba(124, 58, 237, 0.04)',
  },
  // List
  listContent: {
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 56,
    paddingBottom: 40,
  },
  // Header
  header: {
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A78BFA',
  },
  // Empty state
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.1)',
  },
  emptyTitle: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: '#161B2E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#1E2440',
  },
  textArea: {
    flex: 1,
    marginLeft: 14,
  },
  lineWide: {
    width: '75%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1E2440',
    marginBottom: 8,
  },
  lineNarrow: {
    width: '45%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E2440',
  },
  pill: {
    width: 40,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#1E2440',
  },
  btn: {
    width: 62,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E2440',
  },
  header: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarSkel: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#1E2440',
  },
});

export default App;
