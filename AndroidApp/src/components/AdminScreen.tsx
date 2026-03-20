import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    Alert,
    ActivityIndicator,
    ScrollView,
    Dimensions,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pick, types } from 'react-native-document-picker';
import { AppModel, supabase } from '../config/supabase';
import { AdminService } from '../services/AdminService';

interface AdminScreenProps {
    visible: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

const { width, height } = Dimensions.get('window');

type Tab = 'upload' | 'manage';

export const AdminScreen: React.FC<AdminScreenProps> = ({ visible, onClose, onRefresh }) => {
    const [tab, setTab] = useState<Tab>('upload');

    // Upload state
    const [name, setName] = useState('');
    const [version, setVersion] = useState('');
    const [description, setDescription] = useState('');
    const [iconFile, setIconFile] = useState<{ uri: string; name: string } | null>(null);
    const [apkFile, setApkFile] = useState<{ uri: string; name: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState('');

    // Manage state
    const [apps, setApps] = useState<AppModel[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [editingApp, setEditingApp] = useState<AppModel | null>(null);
    const [editName, setEditName] = useState('');
    const [editVersion, setEditVersion] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const loadApps = useCallback(async () => {
        setLoadingApps(true);
        try {
            const { data, error } = await supabase.from('apps').select('*');
            if (!error && data) setApps(data);
        } catch (e) {
            console.error('Admin fetch error:', e);
        } finally {
            setLoadingApps(false);
        }
    }, []);

    useEffect(() => {
        if (visible && tab === 'manage') loadApps();
    }, [visible, tab, loadApps]);

    // ─── Pickers ───
    const pickIcon = async () => {
        try {
            const [res] = await pick({ type: [types.images] });
            setIconFile({ uri: res.uri, name: res.name || 'icon.png' });
        } catch (e: any) {
            if (!e.message?.includes('cancel')) console.error(e);
        }
    };

    const pickApk = async () => {
        try {
            const [res] = await pick({ type: [types.allFiles] });
            if (res.name?.endsWith('.apk') || res.type === 'application/vnd.android.package-archive') {
                setApkFile({ uri: res.uri, name: res.name || 'app.apk' });
            } else {
                Alert.alert('Invalid File', 'Please select a valid .apk file.');
            }
        } catch (e: any) {
            if (!e.message?.includes('cancel')) console.error(e);
        }
    };

    // ─── Upload ───
    const handleUpload = async () => {
        if (!name.trim() || !version.trim() || !description.trim()) {
            Alert.alert('Missing Fields', 'Fill in all text fields.');
            return;
        }
        if (!iconFile) { Alert.alert('Missing Icon', 'Pick an app icon image.'); return; }
        if (!apkFile) { Alert.alert('Missing APK', 'Pick an APK file.'); return; }

        setUploading(true);
        try {
            // Convert content:// to a proper file path
            const iconPath = iconFile.uri.replace('file://', '');
            const apkPath = apkFile.uri.replace('file://', '');

            await AdminService.uploadApp(
                name.trim(),
                version.trim(),
                description.trim(),
                iconPath,
                apkPath,
                setUploadStep,
            );

            Alert.alert('Success', `${name} v${version} published!`);
            setName(''); setVersion(''); setDescription('');
            setIconFile(null); setApkFile(null);
            onRefresh();
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message);
        } finally {
            setUploading(false);
            setUploadStep('');
        }
    };

    // ─── Edit ───
    const startEdit = (app: AppModel) => {
        setEditingApp(app);
        setEditName(app.name);
        setEditVersion(app.version);
        setEditDesc(app.description);
    };

    const saveEdit = async () => {
        if (!editingApp) return;
        try {
            await AdminService.updateApp(editingApp.id, {
                name: editName, version: editVersion, description: editDesc,
            });
            Alert.alert('Updated', 'App details saved.');
            setEditingApp(null);
            loadApps();
            onRefresh();
        } catch (e: any) {
            Alert.alert('Update Failed', e.message);
        }
    };

    // ─── Delete ───
    const handleDelete = (app: AppModel) => {
        Alert.alert(
            'Delete App',
            `Permanently delete "${app.name}"?\nThis also removes the GitHub Release.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AdminService.deleteApp(app.id);
                            Alert.alert('Deleted', `${app.name} removed.`);
                            loadApps();
                            onRefresh();
                        } catch (e: any) {
                            Alert.alert('Delete Failed', e.message);
                        }
                    },
                },
            ],
        );
    };

    // ─── Render ───
    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={s.container}>
                <StatusBar barStyle="light-content" backgroundColor="#080B16" />

                {/* Background */}
                <View style={s.bgBase} />
                <View style={s.bgOrb} />

                {/* Header */}
                <View style={s.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerLabel}>ADMIN</Text>
                        <Text style={s.headerTitle}>App Manager</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                        <Icon name="close" size={22} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={s.tabs}>
                    <TouchableOpacity
                        style={[s.tab, tab === 'upload' && s.tabActive]}
                        onPress={() => setTab('upload')}>
                        <Icon name="cloud-upload" size={18} color={tab === 'upload' ? '#A78BFA' : '#64748B'} />
                        <Text style={[s.tabText, tab === 'upload' && s.tabTextActive]}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.tab, tab === 'manage' && s.tabActive]}
                        onPress={() => setTab('manage')}>
                        <Icon name="cog" size={18} color={tab === 'manage' ? '#A78BFA' : '#64748B'} />
                        <Text style={[s.tabText, tab === 'manage' && s.tabTextActive]}>Manage</Text>
                    </TouchableOpacity>
                </View>

                {/* ──── Upload Tab ──── */}
                {tab === 'upload' && (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}>
                        <ScrollView
                            contentContainerStyle={s.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}>

                            <Text style={s.sectionLabel}>App Details</Text>
                            <TextInput
                                style={s.input}
                                placeholder="App Name"
                                placeholderTextColor="#475569"
                                value={name}
                                onChangeText={setName}
                            />
                            <TextInput
                                style={s.input}
                                placeholder="Version  (e.g. 1.0.0)"
                                placeholderTextColor="#475569"
                                value={version}
                                onChangeText={setVersion}
                            />
                            <TextInput
                                style={[s.input, { height: 90, textAlignVertical: 'top' }]}
                                placeholder="Description"
                                placeholderTextColor="#475569"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                            />

                            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Files</Text>

                            {/* Icon picker */}
                            <TouchableOpacity style={s.filePicker} onPress={pickIcon}>
                                <Icon
                                    name={iconFile ? 'check-circle' : 'image-plus'}
                                    size={28}
                                    color={iconFile ? '#10B981' : '#7C3AED'}
                                />
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={s.fileLabel}>
                                        {iconFile ? iconFile.name : 'Pick App Icon'}
                                    </Text>
                                    <Text style={s.fileHint}>PNG or JPG image</Text>
                                </View>
                                <Icon name="chevron-right" size={20} color="#475569" />
                            </TouchableOpacity>

                            {/* APK picker */}
                            <TouchableOpacity style={s.filePicker} onPress={pickApk}>
                                <Icon
                                    name={apkFile ? 'check-circle' : 'android'}
                                    size={28}
                                    color={apkFile ? '#10B981' : '#7C3AED'}
                                />
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={s.fileLabel}>
                                        {apkFile ? apkFile.name : 'Pick APK File'}
                                    </Text>
                                    <Text style={s.fileHint}>.apk file</Text>
                                </View>
                                <Icon name="chevron-right" size={20} color="#475569" />
                            </TouchableOpacity>

                            {/* Upload button */}
                            <TouchableOpacity
                                style={[s.primaryBtn, uploading && { opacity: 0.6 }]}
                                onPress={handleUpload}
                                disabled={uploading}
                                activeOpacity={0.8}>
                                {uploading ? (
                                    <View style={s.row}>
                                        <ActivityIndicator color="#FFF" size="small" />
                                        <Text style={s.primaryText}>{uploadStep || 'Uploading…'}</Text>
                                    </View>
                                ) : (
                                    <View style={s.row}>
                                        <Icon name="rocket-launch" size={20} color="#FFF" />
                                        <Text style={s.primaryText}>Publish App</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                )}

                {/* ──── Manage Tab ──── */}
                {tab === 'manage' && (
                    <View style={{ flex: 1 }}>
                        {loadingApps ? (
                            <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />
                        ) : apps.length === 0 ? (
                            <View style={s.emptyManage}>
                                <Icon name="package-variant" size={48} color="rgba(167,139,250,0.3)" />
                                <Text style={s.emptyText}>No apps to manage</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={apps}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                                renderItem={({ item }) => (
                                    <View style={s.manageCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.manageName}>{item.name}</Text>
                                            <Text style={s.manageVer}>v{item.version}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => startEdit(item)} style={s.iconBtn}>
                                            <Icon name="pencil" size={18} color="#A78BFA" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item)} style={s.iconBtn}>
                                            <Icon name="trash-can-outline" size={18} color="#F87171" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                )}

                {/* ──── Edit Modal ──── */}
                {editingApp && (
                    <Modal visible transparent animationType="fade">
                        <View style={s.editOverlay}>
                            <View style={s.editSheet}>
                                <Text style={s.editTitle}>Edit "{editingApp.name}"</Text>
                                <TextInput style={s.input} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor="#475569" />
                                <TextInput style={s.input} value={editVersion} onChangeText={setEditVersion} placeholder="Version" placeholderTextColor="#475569" />
                                <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={editDesc} onChangeText={setEditDesc} placeholder="Description" placeholderTextColor="#475569" multiline />
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                    <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: '#1E293B' }]} onPress={() => setEditingApp(null)}>
                                        <Text style={[s.primaryText, { color: '#94A3B8' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={saveEdit}>
                                        <Text style={s.primaryText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        </Modal>
    );
};

// ── Styles ──
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080B16' },
    bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#080B16' },
    bgOrb: {
        position: 'absolute', top: -height * 0.15, right: -width * 0.3,
        width: width, height: width, borderRadius: width * 0.5,
        backgroundColor: 'rgba(124, 58, 237, 0.05)',
    },
    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: (StatusBar.currentHeight || 44) + 12,
        paddingHorizontal: 22, paddingBottom: 12,
    },
    headerLabel: { fontSize: 11, fontWeight: '800', color: '#7C3AED', letterSpacing: 2 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginTop: 2 },
    closeBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
    },
    // Tabs
    tabs: {
        flexDirection: 'row', marginHorizontal: 22, marginBottom: 8,
        borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 4,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: 12, gap: 6,
    },
    tabActive: { backgroundColor: 'rgba(124, 58, 237, 0.12)' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#A78BFA' },
    // Form
    scrollContent: { padding: 22, paddingBottom: 40 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#7C3AED', letterSpacing: 1.5, marginBottom: 14 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
        color: '#F1F5F9', fontSize: 15, marginBottom: 12,
    },
    filePicker: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 16, marginBottom: 12,
    },
    fileLabel: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
    fileHint: { color: '#475569', fontSize: 12, marginTop: 2 },
    primaryBtn: {
        backgroundColor: '#7C3AED', borderRadius: 16,
        paddingVertical: 16, alignItems: 'center', marginTop: 16,
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
    },
    primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    // Manage
    emptyManage: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: '#64748B', fontSize: 16, marginTop: 12 },
    manageCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16, padding: 16, marginBottom: 10,
    },
    manageName: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
    manageVer: { color: '#64748B', fontSize: 12, marginTop: 2 },
    iconBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center', alignItems: 'center', marginLeft: 8,
    },
    // Edit modal
    editOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', padding: 24,
    },
    editSheet: {
        backgroundColor: '#0F172A', borderRadius: 20,
        padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    editTitle: {
        color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 20,
    },
});
