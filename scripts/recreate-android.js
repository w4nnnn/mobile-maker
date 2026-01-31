import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// --- Configuration ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATHS = {
    ROOT: path.resolve(__dirname, '..'),
    ANDROID: path.resolve(__dirname, '../android'),
    APP_CONFIG: path.resolve(__dirname, '../app-config.json'),
    CAP_CONFIG: path.resolve(__dirname, '../capacitor.config.json'),
    PACKAGE_JSON: path.resolve(__dirname, '../package.json'),
    MANIFEST: path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml'),
    LOCAL_PROPS: path.resolve(__dirname, '../android/local.properties'),
};

// --- Helpers ---
const log = (msg) => console.log(msg);
const error = (msg) => console.error(msg);
const runs = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: PATHS.ROOT });

function readJson(filePath) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- Steps ---

function step0_updateConfig() {
    log('\n⚙️  Step 0: Updating Project Configuration...');
    const appConfig = readJson(PATHS.APP_CONFIG);
    log(`   📱 App Name: ${appConfig.appName}`);
    log(`   🆔 App ID: ${appConfig.appId}`);

    if (fs.existsSync(PATHS.CAP_CONFIG)) {
        const capConfig = readJson(PATHS.CAP_CONFIG);
        capConfig.appId = appConfig.appId;
        capConfig.appName = appConfig.appName;
        capConfig.server = { ...(capConfig.server || {}), url: appConfig.webUrl, cleartext: true };
        if (appConfig.backgroundColor) capConfig.backgroundColor = appConfig.backgroundColor;

        writeJson(PATHS.CAP_CONFIG, capConfig);
        log('   ✅ capacitor.config.json updated.');
    } else {
        error('   ⚠️ capacitor.config.json not found.');
    }
    return appConfig;
}

function step0_5_managePlugins(plugins) {
    if (!plugins) return;
    log('\n📦 Step 0.5: Managing Plugins...');

    const pkg = readJson(PATHS.PACKAGE_JSON);
    const installed = { ...pkg.dependencies, ...pkg.devDependencies };

    Object.entries(plugins).forEach(([plugin, isEnabled]) => {
        const isInstalled = !!installed[plugin];
        if (isEnabled && !isInstalled) {
            log(`   ➕ Installing ${plugin}...`);
            runs(`npm install ${plugin}`);
        } else if (!isEnabled && isInstalled) {
            log(`   ➖ Uninstalling ${plugin}...`);
            runs(`npm uninstall ${plugin}`);
        }
    });
}

function step1_buildWeb() {
    log('\n🔨 Step 1: Building Web Assets (Vite)...');
    runs('npm run build');
}

function step2_removeAndroid() {
    if (fs.existsSync(PATHS.ANDROID)) {
        log('\n🗑️  Step 2: Removing existing android directory...');
        fs.rmSync(PATHS.ANDROID, { recursive: true, force: true });
    }
}

function step3_generateAndroid() {
    log('\n✨ Step 3: Generating fresh Android project...');
    runs('npx cap add android');
}

function step4_createLocalProperties() {
    log('\n🔧 Step 4: Generating local.properties...');
    const sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    let targetPath = sdkPath;

    if (!targetPath) {
        log('   ⚠️ ANDROID_HOME not set. Searching default locations...');
        if (process.platform === 'win32') targetPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
        else if (process.platform === 'darwin') targetPath = path.join(process.env.HOME, 'Library', 'Android', 'sdk');
    }

    if (targetPath && fs.existsSync(targetPath)) {
        const escaped = targetPath.replace(/\\/g, '\\\\');
        fs.writeFileSync(PATHS.LOCAL_PROPS, `sdk.dir=${escaped}\n`, 'utf8');
        log(`   ✅ local.properties -> ${targetPath}`);
    } else {
        error('   ❌ Android SDK not found. Please set ANDROID_HOME.');
    }
}

function step5_injectPermissions(permissions) {
    log('\n🛡️  Step 5: Injecting permissions...');
    if (!fs.existsSync(PATHS.MANIFEST)) {
        return error(`   ⚠️ Manifest not found: ${PATHS.MANIFEST}`);
    }

    let content = fs.readFileSync(PATHS.MANIFEST, 'utf8');
    const closingTag = '</manifest>';
    const idx = content.lastIndexOf(closingTag);

    if (idx === -1) return error('   ⚠️ Invalid Manifest format.');

    const toInject = Object.entries(permissions || {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => `<uses-permission android:name="${name}" />`)
        .filter(tag => !content.includes(tag));

    if (toInject.length > 0) {
        content = content.substring(0, idx) +
            '\n    <!-- Auto-injected permissions -->\n    ' +
            toInject.join('\n    ') + '\n' +
            content.substring(idx);
        fs.writeFileSync(PATHS.MANIFEST, content, 'utf8');
        log(`   ✅ Added ${toInject.length} permissions.`);
    } else {
        log('   👍 No new permissions needed.');
    }
}

function step6_finalSync() {
    log('\n🔄 Step 6: Final Sync...');
    runs('npx cap sync');
}

// --- Main Execution ---

async function run() {
    log('🚀 Starting Mobile Maker Build Process...');
    try {
        const config = step0_updateConfig();
        step0_5_managePlugins(config.plugins);
        step1_buildWeb();
        step2_removeAndroid();
        step3_generateAndroid();
        step4_createLocalProperties();
        step5_injectPermissions(config.permissions);
        step6_finalSync();
        log('\n✅✅✅ Build Successful! Run "npx cap run android" to launch. ✅✅✅');
    } catch (e) {
        error('\n❌ Build Failed!');
        console.error(e);
        process.exit(1);
    }
}

run();
