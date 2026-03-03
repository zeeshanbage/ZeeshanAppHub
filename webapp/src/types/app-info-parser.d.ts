declare module 'app-info-parser' {
    class AppInfoParser {
        constructor(filePath: string);
        parse(): Promise<{
            icon: string;
            [key: string]: any;
        }>;
    }
    export default AppInfoParser;
}
