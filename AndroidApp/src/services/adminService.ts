import { supabase, AppModel } from '../config/supabase';
import messaging from '@react-native-firebase/messaging';

export interface InstallRecord {
  id: string;
  device_id: string;
  brand: string;
  model: string;
  system_version: string;
  installed_at: string;
  last_opened: string;
}

export interface IssueRecord {
  id: string;
  device_id: string;
  error_message: string;
  stack_trace: string;
  platform: string;
  created_at: string;
}

export interface TelemetryData {
  installCount: number;
  latestInstalls: InstallRecord[];
  issueCount: number;
  latestIssues: IssueRecord[];
}

// --- Supabase Auth Management ---

export const adminSignIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err: any) {
    return { success: false, error: err.message || 'Authentication failed' };
  }
};

export const adminSignUp = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registration failed' };
  }
};

export const adminSignOut = async () => {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const getAdminSession = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
};

// --- Telemetry Operations ---

export const fetchTelemetryStats = async (): Promise<{ success: boolean; data?: TelemetryData; error?: string }> => {
  try {
    // 1. Fetch Installs Count & Records
    const { count: installCount, error: installCountErr } = await supabase
      .from('installs')
      .select('*', { count: 'exact', head: true });

    if (installCountErr) console.warn('Telemetry install count error:', installCountErr);

    const { data: latestInstalls, error: installErr } = await supabase
      .from('installs')
      .select('*')
      .order('last_opened', { ascending: false })
      .limit(30);

    if (installErr) console.warn('Telemetry installs error:', installErr);

    // 2. Fetch Issues Count & Records
    const { count: issueCount, error: issueCountErr } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact', head: true });

    if (issueCountErr) console.warn('Telemetry issue count error:', issueCountErr);

    const { data: latestIssues, error: issueErr } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (issueErr) console.warn('Telemetry issues error:', issueErr);

    return {
      success: true,
      data: {
        installCount: installCount || 0,
        latestInstalls: (latestInstalls as InstallRecord[]) || [],
        issueCount: issueCount || 0,
        latestIssues: (latestIssues as IssueRecord[]) || [],
      },
    };
  } catch (err: any) {
    console.error('fetchTelemetryStats error:', err);
    return { success: false, error: err.message || 'Failed to load telemetry data' };
  }
};

// --- App Management Operations ---

export const updateAppDetails = async (
  id: string,
  updates: {
    name: string;
    version: string;
    description: string;
    package_name?: string;
    icon_url?: string;
    apk_url?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('apps')
      .update({
        name: updates.name.trim(),
        version: updates.version.trim(),
        description: updates.description.trim(),
        ...(updates.package_name ? { package_name: updates.package_name.trim() } : {}),
        ...(updates.icon_url ? { icon_url: updates.icon_url.trim() } : {}),
        ...(updates.apk_url ? { apk_url: updates.apk_url.trim() } : {}),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error('updateAppDetails error:', err);
    return { success: false, error: err.message || 'Failed to update app' };
  }
};

export const deleteAppRecord = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('apps').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error('deleteAppRecord error:', err);
    return { success: false, error: err.message || 'Failed to delete app' };
  }
};

export const createAppRecord = async (newApp: {
  name: string;
  version: string;
  description: string;
  package_name: string;
  apk_url: string;
  icon_url?: string;
}): Promise<{ success: boolean; data?: AppModel; error?: string }> => {
  try {
    const defaultIcon = 'https://cdn-icons-png.flaticon.com/512/2880/2880661.png';
    const payload = {
      name: newApp.name.trim(),
      version: newApp.version.trim(),
      description: newApp.description.trim(),
      package_name: newApp.package_name.trim(),
      apk_url: newApp.apk_url.trim(),
      icon_url: newApp.icon_url ? newApp.icon_url.trim() : defaultIcon,
      download_count: 0,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('apps').insert([payload]).select('*').single();
    if (error) throw new Error(error.message);

    return { success: true, data: data as AppModel };
  } catch (err: any) {
    console.error('createAppRecord error:', err);
    return { success: false, error: err.message || 'Failed to create app' };
  }
};
