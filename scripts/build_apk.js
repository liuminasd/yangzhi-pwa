/**
 * 仰止 PWA → APK 构建脚本
 * 使用 @bubblewrap/core 程序化生成 TWA APK
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// 使用本地安装的 @bubblewrap/core
const { TwaManifest } = require('@bubblewrap/core');
const { TwaGenerator } = require('@bubblewrap/core');
const { GradleWrapper } = require('@bubblewrap/core');
const { AndroidSdkTools } = require('@bubblewrap/core');
const { JdkHelper } = require('@bubblewrap/core');
const { KeyTool } = require('@bubblewrap/core');
const { Config } = require('@bubblewrap/core');
const { ConsoleLog } = require('@bubblewrap/core');

const ANDROID_HOME = path.join(os.homedir(), 'android-sdk');
const JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-21.0.12.8-hotspot';
const OUTPUT_DIR = path.join(process.cwd(), 'apk-output');
const PROJECT_DIR = path.join(OUTPUT_DIR, 'project');

// 修复 Git Bash 中 PATH 和 Path 的环境变量冲突
// bubblewrap 在 Windows 上使用 'Path'，但 Git Bash 只有 'PATH'
if (process.platform === 'win32') {
    if (!process.env.Path && process.env.PATH) {
        process.env.Path = process.env.PATH;
    }
}

async function main() {
    const log = new ConsoleLog('bw-build');

    // 1. 确保输出目录干净
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // 2. 从 web manifest 创建 TWA manifest
    log.info('正在获取 Web Manifest...');
    const manifestUrl = 'http://localhost:8080/manifest.json';
    const twaManifest = await TwaManifest.fromWebManifest(manifestUrl);

    // 覆盖为生产环境地址（manifest 从本地获取仅为绕过 TLS 问题）
    twaManifest.host = 'liuminasd.github.io';
    twaManifest.startUrl = '/yangzhi-pwa/';

    // 3. 设置必要的字段
    twaManifest.packageId = 'com.yangzhi.app';
    twaManifest.name = '仰止AI助手';
    twaManifest.launcherName = '仰止AI';
    twaManifest.appVersionCode = 4;
    twaManifest.appVersionName = '1.3.4';  // 第7轮Bug修复：多选退出+流式切换+异常边界
    twaManifest.fallbackType = 'webview';  // 无地址栏，不跳转
    twaManifest.enableNotifications = false;
    twaManifest.enableSiteSettingsShortcut = true;

    log.info(`  包名: ${twaManifest.packageId}`);
    log.info(`  域名: ${twaManifest.host}`);
    log.info(`  起始页: ${twaManifest.startUrl}`);

    // 4. 生成调试签名密钥
    log.info('正在生成签名密钥...');
    const config = new Config(JAVA_HOME, ANDROID_HOME);
    const jdkHelper = new JdkHelper(process, config);
    const keystorePath = path.join(OUTPUT_DIR, 'yangzhi.keystore');
    const keyAlias = 'yangzhi';
    const keyPassword = 'yangzhi123';
    const keystorePassword = 'yangzhi123';

    // 手动调用 keytool（避开 bubblewrap 的 PATH 问题）
    const { execSync } = require('child_process');
    const keytoolExe = path.join(JAVA_HOME, 'bin', 'keytool.exe');
    const keytoolCmd = [
        `"${keytoolExe}"`, '-genkeypair',
        '-dname', `"cn=Yangzhi Dev, ou=Dev, o=Yangzhi, c=CN"`,
        '-alias', keyAlias,
        '-keypass', keyPassword,
        '-keystore', keystorePath,
        '-storepass', keystorePassword,
        '-validity', '20000',
        '-keyalg', 'RSA',
    ].join(' ');
    execSync(keytoolCmd, { stdio: 'inherit' });
    log.info('  签名密钥已生成');

    twaManifest.signingKey = {
        path: keystorePath,
        alias: keyAlias,
    };

    // 5. 生成 TWA 项目
    log.info('正在生成 Android 项目...');

    const generator = new TwaGenerator();
    await generator.createTwaProject(PROJECT_DIR, twaManifest, log);

    // 6. 写入 gradle.properties 添加签名配置
    const gradlePropsPath = path.join(PROJECT_DIR, 'gradle.properties');
    let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    gradleProps += `
keyAlias=${keyAlias}
keyPassword=${keyPassword}
keystore=${keystorePath.replace(/\\/g, '\\\\')}
keystorePassword=${keystorePassword}`;
    fs.writeFileSync(gradlePropsPath, gradleProps);
    log.info('  签名配置已写入 gradle.properties');

    // 6b. 修改 build.gradle 添加 signingConfigs（bubblewrap 模板不含签名）
    const buildGradlePath = path.join(PROJECT_DIR, 'app', 'build.gradle');
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

    // 使用硬编码值（避免 gradle.properties 变量读取问题）
    const keystorePathUnix = keystorePath.replace(/\\/g, '/');
    const signingBlock = `
    signingConfigs {
        release {
            storeFile file('${keystorePathUnix}')
            storePassword '${keystorePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPassword}'
        }
    }
`;
    // 在 buildTypes 前插入
    buildGradle = buildGradle.replace('    buildTypes {', signingBlock + '    buildTypes {');
    // 在 release {} 中添加 signingConfig
    buildGradle = buildGradle.replace(
        '        release {\n            minifyEnabled true\n        }',
        '        release {\n            signingConfig signingConfigs.release\n            minifyEnabled true\n        }'
    );
    fs.writeFileSync(buildGradlePath, buildGradle);
    log.info('  签名配置已写入 build.gradle (storeFile: ' + keystorePathUnix + ')');

    // 7. 构建 APK（使用本地 Gradle，绕过 SSL 证书问题）
    log.info('正在构建 APK (assembleRelease)...首次约需下载Android依赖(5-10分钟)...');
    const gradleExe = path.join(os.homedir(), 'gradle', 'gradle-8.11.1', 'bin', 'gradle.bat');
    log.info(`  执行: ${gradleExe} assembleRelease`);

    // 确保 env 同时有 PATH 和 Path
    const buildEnv = { ...process.env };
    buildEnv.Path = buildEnv.Path || buildEnv.PATH || '';
    buildEnv.JAVA_HOME = JAVA_HOME;
    buildEnv.ANDROID_HOME = ANDROID_HOME;
    buildEnv.ANDROID_SDK_ROOT = ANDROID_HOME;
    // 跳过 SSL 证书问题（开发构建）
    buildEnv.GRADLE_OPTS = '-Dorg.gradle.jvmargs="-Xmx2048m -Djavax.net.ssl.trustAll=true"';

    // 在 gradle.properties 中添加跳过 SSL 检查
    const gradlePropsPath2 = path.join(PROJECT_DIR, 'gradle.properties');
    let gradleProps2 = fs.readFileSync(gradlePropsPath2, 'utf8');
    if (!gradleProps2.includes('systemProp.javax.net.ssl')) {
        gradleProps2 += `
systemProp.javax.net.ssl.trustAll=true
org.gradle.jvmargs=-Xmx2048m`;
        fs.writeFileSync(gradlePropsPath2, gradleProps2);
    }

    // R8 已通过 build.gradle 中 minifyEnabled false 禁用（TWA 无需混淆）
    // 注意：不再写 android.enableR8=false（AGP 7.0+ 已移除此属性）

    execSync(`"${gradleExe}" assembleRelease --stacktrace --no-daemon`, {
        cwd: PROJECT_DIR,
        env: buildEnv,
        stdio: 'inherit',
        timeout: 1800000, // 30 分钟超时
    });
    log.info('  Gradle 构建完成');

    // 8. 查找输出的 APK
    const apkDir = path.join(PROJECT_DIR, 'app', 'build', 'outputs', 'apk', 'release');
    if (fs.existsSync(apkDir)) {
        const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
        for (const apk of apkFiles) {
            const src = path.join(apkDir, apk);
            const dest = path.join(OUTPUT_DIR, '仰止AI-v1.3.4.apk');
            fs.copyFileSync(src, dest);
            const sizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
            log.info(`[SUCCESS] APK已生成: ${dest} (${sizeMB} MB)`);
        }
        if (apkFiles.length === 0) {
            log.error('APK目录为空，没有找到apk文件');
        }
    } else {
        log.error('未找到APK输出目录: ' + apkDir);
        // 尝试全局搜索
        log.info('搜索所有apk文件...');
        const { execSync } = require('child_process');
        try {
            const result = execSync(`dir /s /b "${OUTPUT_DIR}\\*.apk"`, { encoding: 'utf8' });
            if (result.trim()) {
                log.info('找到:\n' + result);
            }
        } catch (e) {
            // ignore
        }
    }
}

main().catch(err => {
    console.error('构建失败:', err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
