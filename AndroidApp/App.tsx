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
} from 'react-native';
import { fetchApps, AppModel } from './src/config/supabase';
import { AppCard } from './src/components/AppCard';
import { AppDetailsPopup } from './src/components/AppDetailsPopup';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
    setTimeout(() => setSelectedApp(null), 300); // Allow animation to finish
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTextContainer}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.title}>Zeeshan Hub</Text>
      </View>
      <View style={styles.profileAvatar}>
        <Icon name="account-circle" size={48} color="#00B4D8" />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Subtle modern gradient/image background */}
      <View style={styles.backgroundAccent} />
      <View style={styles.backgroundAccent2} />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B4D8" />
          <Text style={styles.loadingText}>Connecting to Hub...</Text>
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
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="cloud-off-outline" size={64} color="#4A5568" />
              <Text style={styles.emptyText}>No applications found.</Text>
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
    backgroundColor: '#0B132B', // Deep dark blue background
  },
  backgroundAccent: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 180, 216, 0.1)',
    blurRadius: 50,
  },
  backgroundAccent2: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(107, 70, 193, 0.08)',
    blurRadius: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#00B4D8',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#A0AEC0',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  profileAvatar: {
    marginLeft: 16,
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#A0AEC0',
    fontSize: 18,
    marginTop: 16,
  },
});

export default App;
