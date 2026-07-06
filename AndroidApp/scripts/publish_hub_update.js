const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// Trigger workflow run after updating lockfile and commands
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read environment variables from GitHub Secrets and strip any quotes
function cleanEnv(val) {
    if (!val) return val;
    return val.trim().replace(/^["'](.*)["']$/, '$1');
}

const r2AccessKeyId = cleanEnv(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
const r2SecretAccessKey = cleanEnv(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
const r2AccountId = cleanEnv(process.env.CLOUDFLARE_R2_ACCOUNT_ID);
const r2BucketName = cleanEnv(process.env.CLOUDFLARE_R2_BUCKET_NAME);
const r2PublicUrl = cleanEnv(process.env.CLOUDFLARE_R2_PUBLIC_URL);

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!r2AccessKeyId || !r2SecretAccessKey || !r2AccountId || !r2BucketName || !r2PublicUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing required environment variables.');
    process.exit(1);
}

// 2. Read current app version from AndroidApp/package.json
const packageJsonPath = path.join(__dirname, '../package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error('Error: package.json not found at', packageJsonPath);
    process.exit(1);
}
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;
const appName = "Zeeshan's App Hub";
const packageName = "com.androidapp";

console.log(`Publishing Hub update for ${appName} (${packageName}), version ${version}...`);

// 3. Locate the compiled APK file
const releaseDir = path.join(__dirname, '../android/app/build/outputs/apk/release');
let apkPath = '';

if (fs.existsSync(releaseDir)) {
    try {
        const files = fs.readdirSync(releaseDir);
        const apkFile = files.find(f => f.endsWith('.apk') && fs.statSync(path.join(releaseDir, f)).isFile());
        if (apkFile) {
            apkPath = path.join(releaseDir, apkFile);
            console.log(`Found APK dynamically: ${apkPath}`);
        }
    } catch (e) {
        console.warn('Dynamic APK search warning:', e.message);
    }
}

if (!apkPath) {
    const apkPaths = [
        path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk'),
        path.join(__dirname, '../android/app/build/outputs/apk/release/app-arm64-v8a-release.apk')
    ];
    for (const p of apkPaths) {
        if (fs.existsSync(p)) {
            apkPath = p;
            break;
        }
    }
}

if (!apkPath) {
    console.error('Error: Compiled APK not found.');
    process.exit(1);
}

// 4. Initialize clients
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
    },
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    const r2Key = `apks/ZeeshanHub_v${version.replace(/\./g, '')}.apk`;
    let apkDownloadUrl = '';

    try {
        try {
            // 5. Upload APK to Cloudflare R2
            console.log(`Uploading APK to R2: ${r2Key}...`);
            const fileStream = fs.createReadStream(apkPath);
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: r2BucketName,
                    Key: r2Key,
                    Body: fileStream,
                    ContentType: 'application/vnd.android.package-archive',
                })
            );
            apkDownloadUrl = `${r2PublicUrl.replace(/\/$/, '')}/${r2Key}`;
            console.log(`Successfully uploaded APK to R2: ${apkDownloadUrl}`);
        } catch (r2Error) {
            console.warn(`Warning: R2 upload failed (${r2Error.message}). Falling back to Supabase Storage...`);
            try {
                const apkBuffer = fs.readFileSync(apkPath);
                const apkFileName = `ZeeshanHub_v${version.replace(/\./g, '')}_${Date.now()}.apk`;

                console.log(`Uploading ${apkFileName} to Supabase storage 'apks' bucket...`);
                const { error: uploadError } = await supabase.storage
                    .from('apks')
                    .upload(apkFileName, apkBuffer, {
                        upsert: true,
                        contentType: 'application/vnd.android.package-archive'
                    });

                if (uploadError) {
                    throw new Error(`Supabase upload failed: ${uploadError.message}`);
                }

                // Get a long-lived signed URL (100 years)
                const { data: signedData, error: signError } = await supabase.storage
                    .from('apks')
                    .createSignedUrl(apkFileName, 60 * 60 * 24 * 365 * 100);

                if (signError || !signedData) {
                    throw new Error(`Failed to sign Supabase URL: ${signError?.message}`);
                }

                apkDownloadUrl = signedData.signedUrl;
                console.log(`Successfully uploaded APK to Supabase! URL: ${apkDownloadUrl}`);
            } catch (fallbackError) {
                console.error(`Error: Fallback to Supabase Storage also failed:`, fallbackError.message);
                throw fallbackError;
            }
        }

        // 6. Upload app icon to Supabase Storage dynamically from built assets
        const localIconPath = path.join(__dirname, '../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
        let iconUrl = "https://cdn-icons-png.flaticon.com/512/5186/5186259.png"; // fallback
        
        if (fs.existsSync(localIconPath)) {
            try {
                console.log(`Uploading app icon to Supabase Storage...`);
                const iconBuffer = fs.readFileSync(localIconPath);
                const iconFileName = `zeeshanhub_icon_${Date.now()}.png`;
                
                const { error: iconUploadError } = await supabase.storage
                    .from('icons')
                    .upload(iconFileName, iconBuffer, { upsert: false, contentType: 'image/png' });
                    
                if (iconUploadError) {
                    throw new Error(iconUploadError.message);
                }
                
                const { data: signedData, error: signError } = await supabase.storage
                    .from('icons')
                    .createSignedUrl(iconFileName, 60 * 60 * 24 * 365 * 100); // 100 years
                    
                if (signError || !signedData) {
                    throw new Error(signError?.message || 'Failed to sign url');
                }
                
                iconUrl = signedData.signedUrl;
                console.log(`Icon successfully uploaded: ${iconUrl}`);
            } catch (iconErr) {
                console.warn(`Warning: Failed to upload custom app icon, using fallback:`, iconErr.message);
            }
        }

        // 7. Check if app already exists in Supabase
        console.log(`Querying DB for app with package_name: ${packageName}...`);
        const { data: existingApp, error: fetchError } = await supabase
            .from('apps')
            .select('*')
            .eq('package_name', packageName)
            .maybeSingle();

        if (fetchError) {
            throw new Error(`Failed to fetch from DB: ${fetchError.message}`);
        }

        const appData = {
            name: appName,
            version: version,
            apk_url: apkDownloadUrl,
            description: "Zeeshan App Hub Client Application. Download updates directly from the hub!",
            icon_url: iconUrl, 
        };

        if (existingApp) {
            console.log(`App exists in DB (ID: ${existingApp.id}). Updating version to ${version}...`);

            const { error: updateError } = await supabase
                .from('apps')
                .update({
                    version: version,
                    apk_url: apkDownloadUrl,
                    icon_url: appData.icon_url,
                    description: appData.description,
                })
                .eq('id', existingApp.id);

            if (updateError) {
                throw new Error(`Failed to update DB: ${updateError.message}`);
            }
            console.log(`Successfully updated DB record.`);
        } else {
            console.log(`App does not exist in DB. Inserting new record...`);
            const { error: insertError } = await supabase
                .from('apps')
                .insert([
                    {
                        name: appName,
                        version: version,
                        apk_url: apkDownloadUrl,
                        description: appData.description,
                        icon_url: appData.icon_url,
                        package_name: packageName,
                    }
                ]);

            if (insertError) {
                throw new Error(`Failed to insert into DB: ${insertError.message}`);
            }
            console.log(`Successfully inserted new DB record.`);
        }

        console.log('App Hub update published successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Publish failed:', err.message);
        process.exit(1);
    }
}

run();
