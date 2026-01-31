import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
const appConfigPath = path.join(projectRoot, 'app-config.json');
const capacitorConfigPath = path.join(projectRoot, 'capacitor.config.json');

// Permissions to ensure are present in the manifest
const REQUIRED_PERMISSIONS = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'
];

function updateConfig() {
    console.log('\n⚙️  Step 0: Updating Project Configuration...');

    if (!fs.existsSync(appConfigPath)) {
        console.error('❌ app-config.json not found!');
        process.exit(1);
    }

    // 1. Read app-config.json
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    console.log(`   📱 App Name: ${appConfig.appName}`);
    console.log(`   🆔 App ID: ${appConfig.appId}`);
    console.log(`   🌐 Web URL: ${appConfig.webUrl}`);

    // 2. Read and Update capacitor.config.json
    if (fs.existsSync(capacitorConfigPath)) {
        const capConfig = JSON.parse(fs.readFileSync(capacitorConfigPath, 'utf8'));

        // Update fields
        capConfig.appId = appConfig.appId;
        capConfig.appName = appConfig.appName;
        capConfig.server = {
            ...(capConfig.server || {}),
            url: appConfig.webUrl,
            cleartext: true
        };

        // Optional: Set startup background color if provided
        if (appConfig.backgroundColor) {
            capConfig.backgroundColor = appConfig.backgroundColor;
        }

        fs.writeFileSync(capacitorConfigPath, JSON.stringify(capConfig, null, 2), 'utf8');
        console.log('   ✅ capacitor.config.json updated.');
    } else {
        console.error('   ⚠️ capacitor.config.json not found.');
    }
}

// 0.5 Helper to manage plugins
function managePlugins(plugins) {
    if (!plugins) return;
    console.log('\n📦 Step 0.5: Managing Plugins...');

    // Get installed plugins from package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const installedDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    for (const [pluginName, isEnabled] of Object.entries(plugins)) {
        const isInstalled = !!installedDeps[pluginName];

        if (isEnabled && !isInstalled) {
            console.log(`   ➕ Installing ${pluginName}...`);
            execSync(`npm install ${pluginName}`, { stdio: 'inherit', cwd: projectRoot });
        } else if (!isEnabled && isInstalled) {
            console.log(`   ➖ Uninstalling ${pluginName}...`);
            execSync(`npm uninstall ${pluginName}`, { stdio: 'inherit', cwd: projectRoot });
        }
    }
}

async function run() {
    console.log('🚀 Starting Mobile Maker Build Process...');

    try {
        // 0. Update Config (Integrated)
        updateConfig();

        // Read config again to get plugins/permissions
        const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));

        // 0.5 Manage Plugins
        managePlugins(appConfig.plugins);

        // 1. Build Web Assets
        console.log('\n🔨 Step 1: Building Web Assets (Vite)...');
        execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

        // 2. Remove existing android folder
        if (fs.existsSync(androidDir)) {
            console.log('\n🗑️  Step 2: Removing existing android directory...');
            fs.rmSync(androidDir, { recursive: true, force: true });
        }

        // 3. Add android platform again
        console.log('\n✨ Step 3: Generating fresh Android project...');
        execSync('npx cap add android', { stdio: 'inherit', cwd: projectRoot });

        // 4. Create local.properties
        console.log('\n🔧 Step 4: Generating local.properties...');
        const sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

        let pathToWrite = null;
        if (sdkPath) {
            pathToWrite = sdkPath;
        } else {
            console.warn('   ⚠️ ANDROID_HOME not set. Trying to find SDK path automatically...');
            if (process.platform === 'win32') {
                pathToWrite = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
            } else if (process.platform === 'darwin') {
                pathToWrite = path.join(process.env.HOME, 'Library', 'Android', 'sdk');
            }
        }

        if (pathToWrite && fs.existsSync(pathToWrite)) {
            const escapedPath = pathToWrite.replace(/\\/g, '\\\\');
            const localPropertiesPath = path.join(androidDir, 'local.properties');
            fs.writeFileSync(localPropertiesPath, `sdk.dir=${escapedPath}\n`, 'utf8');
            console.log(`   ✅ local.properties created pointing to: ${pathToWrite}`);
        } else {
            console.error('   ❌ Could not find Android SDK automatically.');
        }

        // 5. Inject Permissions
        console.log('\n🛡️  Step 5: Injecting permissions into AndroidManifest.xml...');
        if (fs.existsSync(manifestPath)) {
            let manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const closingTagIndex = manifestContent.lastIndexOf('</manifest>');

            if (closingTagIndex !== -1) {
                // Get Enabled Permissions from Config + Default Required ones (Internet is usually mandatory)
                const configPermissions = appConfig.permissions || {};
                const permissionsToInject = [];

                for (const [permString, isEnabled] of Object.entries(configPermissions)) {
                    if (isEnabled) {
                        permissionsToInject.push(`<uses-permission android:name="${permString}" />`);
                    }
                }

                // Filter out permissions that are already in the manifest (unlikely for a fresh project, but good practice)
                const uniquePermissions = permissionsToInject.filter(
                    perm => !manifestContent.includes(perm)
                );

                if (uniquePermissions.length > 0) {
                    const newContent =
                        manifestContent.substring(0, closingTagIndex) +
                        '\n    <!-- Auto-injected permissions -->\n    ' +
                        uniquePermissions.join('\n    ') +
                        '\n' +
                        manifestContent.substring(closingTagIndex);

                    fs.writeFileSync(manifestPath, newContent, 'utf8');
                    console.log(`   ✅ Added ${uniquePermissions.length} permissions.`);
                } else {
                    console.log('   👍 No new permissions to add.');
                }
            } else {
                console.error('   ⚠️  Could not find </manifest> tag.');
            }
        } else {
            console.error(`   ⚠️  Manifest file not found at ${manifestPath}`);
        }

        // 6. Sync Capacitor
        console.log('\n🔄 Step 6: Final Sync...');
        execSync('npx cap sync', { stdio: 'inherit', cwd: projectRoot });

        console.log('\n✅✅✅ All Done! Project is ready. ✅✅✅');
        console.log('👉 Run "npx cap run android" to launch on device/emulator.');

    } catch (error) {
        console.error('\n❌ Build Process Failed!');
        console.error(error);
        process.exit(1);
    }
}

run();
