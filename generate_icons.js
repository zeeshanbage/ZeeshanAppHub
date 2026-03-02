const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const iconPath = process.argv[2];
if (!iconPath) {
    console.error('Please provide the path to the original icon image.');
    process.exit(1);
}

const androidResPath = path.join(__dirname, 'AndroidApp', 'android', 'app', 'src', 'main', 'res');

const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
    try {
        const originalImage = await Jimp.read(iconPath);

        for (const [folder, size] of Object.entries(sizes)) {
            const targetFolder = path.join(androidResPath, folder);

            // Ensure folder exists
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            // Generate ic_launcher.png (square/rounded-square)
            const imageLauncher = originalImage.clone();
            imageLauncher.resize(size, size);
            await imageLauncher.writeAsync(path.join(targetFolder, 'ic_launcher.png'));

            // Generate ic_launcher_round.png (circle crop)
            const imageRound = originalImage.clone().resize(size, size);
            imageRound.circle();
            await imageRound.writeAsync(path.join(targetFolder, 'ic_launcher_round.png'));

            console.log(`Generated ${size}x${size} icons in ${folder}`);
        }
        console.log('Successfully generated all Android app icons!');
    } catch (err) {
        console.error('Error generating icons:', err);
    }
}

generateIcons();
