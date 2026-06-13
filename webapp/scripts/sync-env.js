const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found in webapp directory.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');

const r2Keys = [
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_PUBLIC_URL'
];

console.log('Parsing .env.local...');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    // Remove surrounding quotes if any
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envVars[key] = val;
  }
});

// Sync to Vercel
console.log('\n--- Syncing to Vercel ---');
try {
  // Check if vercel CLI is running and linked
  execSync('npx vercel --version', { stdio: 'ignore' });
} catch (e) {
  console.error('Vercel CLI not found or failed to execute.');
  process.exit(1);
}

r2Keys.forEach(key => {
  const value = envVars[key];
  if (!value) {
    console.warn(`Warning: ${key} not found in .env.local, skipping.`);
    return;
  }

  const environments = ['production', 'preview', 'development'];
  environments.forEach(env => {
    try {
      console.log(`Setting ${key} in ${env}...`);
      // Pipe value into vercel env add to support non-interactive additions
      execSync(`echo -n "${value}" | npx vercel env add ${key} ${env}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed to set ${key} in ${env}. Ensure you are linked to the vercel project (run 'npx vercel link').`);
    }
  });
});

console.log('\nDone syncing environment variables to Vercel!');
