export interface AppModel {
    id?: string;
    name: string;
    version: string;
    icon_url: string;
    apk_url: string;
    description: string;
    package_name?: string;
    download_count?: number;
}
