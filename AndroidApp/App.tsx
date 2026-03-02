import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { fetchApps, AppModel } from './src/config/supabase';
import { AppCard } from './src/components/AppCard';
import { AppDetailsPopup } from './src/components/AppDetailsPopup';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

function App(): React.JSX.Element {
  const [apps, setApps] = useState<AppModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppModel | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);

  const loadApps = async () => {
    try {
      const data = await fetchApps();
      setApps(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadApps();
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
    setTimeout(() => setSelectedApp(null), 300);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTextContainer}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.title}>Zeeshan Hub</Text>
      </View>
      <View style={styles.profileAvatarContainer}>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>Z</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Modern Background Orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B4D8" style={styles.spinner} />
          <Text style={styles.loadingText}>Fetching available apps...</Text>
        </View>
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
              tintColor="#00B4D8"
              colors={['#00B4D8']}
              progressBackgroundColor="#1E293B"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Icon name="package-variant" size={80} color="rgba(255, 255, 255, 0.2)" />
              </View>
              <Text style={styles.emptyTitle}>It's quiet here</Text>
              <Text style={styles.emptyText}>Upload your first app via the Admin Portal to see it here.</Text>
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
    backgroundColor: '#050814',
  },
  orb1: {
    position: 'absolute',
    top: -height * 0.1,
    left: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(0, 180, 216, 0.12)',
    // React Native does not support blurRadius on View natively perfectly on all Androids without specific properties, 
    // so we rely on low opacity and large size for the gradient effect.
  },
  orb2: {
    position: 'absolute',
    top: height * 0.4,
    right: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(88, 30, 255, 0.08)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    transform: [{ scale: 1.2 }],
    marginBottom: 20,
  },
  loadingText: {
    color: '#00B4D8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 60,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  profileAvatarContainer: {
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00B4D8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#050814',
  },
  avatarText: {
    color: '#050814',
    fontSize: 24,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.15,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;
