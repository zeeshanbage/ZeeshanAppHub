const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Install tweetsodium on the fly if not present
try {
    require.resolve('tweetsodium');
} catch (e) {
    console.log('Installing tweetsodium for secret encryption...');
    execSync('npm install --no-save tweetsodium', { stdio: 'inherit' });
}
const tweetsodium = require('tweetsodium');

// 2. Load credentials
const envPath = path.join(__dirname, '../.env');
const webEnvPath = path.join(__dirname, '../../webapp/.env.local');

const secrets = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
            const key = match[1];
            let val = match[2] ? match[2].trim() : '';
            val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
            if (key === 'EXPO_PUBLIC_SUPABASE_URL') secrets['NEXT_PUBLIC_SUPABASE_URL'] = val;
            if (key === 'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') secrets['SUPABASE_SERVICE_ROLE_KEY'] = val;
        }
    });
}

if (fs.existsSync(webEnvPath)) {
    const envContent = fs.readFileSync(webEnvPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
            const key = match[1];
            let val = match[2] ? match[2].trim() : '';
            val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
            if (key.startsWith('CLOUDFLARE_R2_')) {
                secrets[key] = val;
            }
        }
    });
}

// Check missing
const requiredSecrets = [
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
];

const missing = requiredSecrets.filter(s => !secrets[s]);
if (missing.length > 0) {
    console.error('Error: Missing local secrets:', missing.join(', '));
    process.exit(1);
}

// 3. Get token from command line arguments
const githubToken = process.argv[2];
if (!githubToken) {
    console.error('Usage: node setup_secrets.js <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>');
    console.error('Generate a token at https://github.com/settings/tokens with "repo" scope.');
    process.exit(1);
}

const repo = "zeeshanbage/ZeeshanAppHub";
const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${githubToken}`,
    'User-Agent': 'NodeJS-Secret-Uploader'
};

async function uploadSecret(name, value, publicKey, keyId) {
    // Encrypt the secret value
    const messageBytes = Buffer.from(value);
    const keyBytes = Buffer.from(publicKey, 'base64');
    const encryptedBytes = tweetsodium.seal(messageBytes, keyBytes);
    const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

    // Send to GitHub
    const url = `https://api.github.com/repos/${repo}/actions/secrets/${name}`;
    const body = JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: keyId
    });

    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to upload secret ${name}: ${err}`);
    }
    console.log(`Successfully uploaded secret: ${name}`);
}

async function run() {
    try {
        console.log(`Fetching public key for repository: ${repo}...`);
        const pubKeyUrl = `https://api.github.com/repos/${repo}/actions/secrets/public-key`;
        const res = await fetch(pubKeyUrl, { headers });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to fetch public key (check if your token has "repo" access): ${err}`);
        }
        const { key, key_id } = await res.json();
        console.log(`Public key retrieved. Uploading secrets...`);

        for (const name of requiredSecrets) {
            await uploadSecret(name, secrets[name], key, key_id);
        }

        console.log('\nAll secrets have been successfully added to GitHub!');
    } catch (e) {
        console.error('\nError setting up secrets:', e.message);
        process.exit(1);
    }
}

run();
