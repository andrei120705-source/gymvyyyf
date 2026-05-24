const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const filesToCopy = [
    'index.html',
    'Gymveo.html',
    '1rm_calculator.html',
    'service-worker.js',
    'sw.js',
    'manifest.json',
    'tailwind.js',
    'vue.global.prod.js',
    'chart.js',
    '_redirects',
    'icon-72x72.png',
    'icon-96x96.png',
    'icon-128x128.png',
    'icon-144x144.png',
    'icon-152x152.png',
    'icon-192x192.png',
    'icon-384x384.png',
    'icon-512x512.png',
    'icon.png'
];

console.log('Syncing latest files from e:\\Games...');
filesToCopy.forEach(file => {
    const src = path.join('e:\\Games', file);
    const dest = path.join('e:\\Games\\WorkoutDiaryForWeb', file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Synced: ${file}`);
    } else {
        console.warn(`Warning: File not found in workspace root: ${file}`);
    }
});

// Создаем 200.html для поддержки SPA маршрутизации на Surge
const indexPath = path.join('e:\\Games\\WorkoutDiaryForWeb', 'index.html');
const fallbackPath = path.join('e:\\Games\\WorkoutDiaryForWeb', '200.html');
if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, fallbackPath);
    console.log('Created 200.html for Surge routing fallback.');
}

console.log('Deploying to Surge...');
const surge = spawn('cmd.exe', ['/c', 'npx', 'surge', '--project', '.', '--domain', 'gymveo-app.surge.sh'], {
    cwd: 'e:\\Games\\WorkoutDiaryForWeb',
    stdio: 'inherit'
});

surge.on('close', (code) => {
    console.log('Finished with code', code);
    process.exit(code);
});
