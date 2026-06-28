declare module 'app-info-parser' {
    class AppInfoParser {
        constructor(filePath: string | File);
        parse(): Promise<{
            icon: string;
            package: string;
            versionName: string;
            application: {
                label?: string | string[];
            };
            [key: string]: any;
        }>;
    }
    export default AppInfoParser;
}

declare module 'app-info-parser/dist/app-info-parser.js' {
    import AppInfoParser from 'app-info-parser';
    export default AppInfoParser;
}
