# 生成安卓 APK · 操作指南

工程已就绪：`android/` 原生骨架完整（包名 `com.liang.liferestart`，compileSdk 34，release 未开 minify）。
出 APK 需要 **JDK 17 + Android SDK**——下面两条路线都不用你在这台机器上手动配这套环境。

---

## 路线 A：GitHub Actions 云端出包（推荐，本机零安装）

你本机**不需要装 JDK/SDK/Android Studio**，全部在 GitHub 的云端 Runner 里完成。
（你 CodeX 那条线已经在用 GitHub Actions 出 APK，流程熟悉。）

> **前置：本机需安装 Git**（出包本身在云端，但「推送代码」要用 Git 命令行）
> 在 PowerShell 执行 `git --version`，若提示“无法识别”，说明没装或没进 PATH：
> - **有 winget（Win10/11 一般自带）**：管理员 PowerShell 跑 `winget install --id Git.Git -e --source winget`，装完**务必重开终端**让 PATH 生效。
> - **无 winget**：去 https://git-scm.com/download/win 下载 Git for Windows，安装时勾选 **Git from the command line and also from 3rd-party software**（加入 PATH）。
> - 验证：`git --version` 能打印版本号即成功（`git` 是 exe，PowerShell 直接调用，不会像 `npm` 那样被 ps1 策略拦）。
> - 不想装命令行：也可装 **GitHub Desktop** 用图形界面推送，但底层仍依赖 Git。

### 步骤
1. 在 GitHub 新建一个 **Private** 仓库（例如 `life-restart-app`）。
2. 在你本机终端（工程目录下）初始化并推送：
   ```bat
   cd C:\Users\liang\WorkBuddy\2026-09-16-14-14-19\life-restart-app
   git init
   git add .
   git commit -m "init life restart app"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
   > `.gitignore` 已忽略 `node_modules/`、`dist/`、`android/app/build/`、`*.log`、密钥库，
   > 只会传源码 + `android/` 骨架 + `package-lock.json` + gradle wrapper，体积很小。
3. 推送后自动触发 Actions；或去仓库 **Actions → Build Android APK → Run workflow** 手动触发。
4. 等构建完成（首次约 10–20 分钟，要下载 Gradle 分发和 AndroidX 依赖）。
5. 在 **Actions → 本次运行 → Artifacts** 里下载 `life-restart-apk.zip`，解压得到 `app-debug.apk`。
6. 把 `app-debug.apk` 传到手机安装（见文末「安装到手机」）。

> 之后每次改了 `src/` 或 `index.html`，重新 `git add . && git commit && git push` 即可自动出新包。

---

## 路线 B：本机 Android Studio 出包（备选，完全本地可控）

适合不想依赖 GitHub、想要本地全程掌控的情况。代价：本机要装 ~3GB 的 Android Studio。

### 步骤
1. 装 **Android Studio**（自带 JDK 17 + SDK Manager）。
2. 首次启动打开 **SDK Manager**，装：
   - **Android 14 (API 34) SDK Platform**
   - **Android SDK Build-Tools 34.0.0**
   - **Android SDK Platform-Tools**
3. 工程目录终端同步最新 Web 代码进原生工程：
   ```bat
   cd C:\Users\liang\WorkBuddy\2026-09-16-14-14-19\life-restart-app
   npm.cmd exec cap sync android
   ```
4. Android Studio → **Open** → 选 `life-restart-app/android` 文件夹。
5. **Build → Generate Signed Bundle or APK → APK → Create new keystore**：
   - Key store path 自选（例如 `D:\liferestart.jks`），**密码务必记住并备份**！
   - Key alias 默认 `my-key`，填密码 + 有效期（例如 25 年）。
   - 选 **release** → Next → 输出 `android/app/release/app-release.apk`。
6. 手机装 `app-release.apk`。

> ⚠️ keystore 密码丢失 = 无法再升级同一签名的包（只能卸载重装）。keystore 文件（`*.jks`）已加入 `.gitignore`，**不要提交到仓库**，本地备份好。

---

## 安装到手机
- Android 8+：设置里给「文件管理/浏览器」开启「允许安装未知应用」权限。
- 把 APK 传到手机（微信文件传输/数据线/网盘），点开安装即可。
- debug 包与 release 包包名相同，重复安装会覆盖，无需先卸载。

---

## 升级为正式签名 release（进阶，路线 A 适用）
当前 workflow 出的是 **debug 包**（用 Android 默认 debug key 签名，个人自用完全够）。
若要正式 release 签名包（防止某些系统限制、长期稳定），在 GitHub 仓库：
1. **Settings → Secrets and variables → Actions → New repository secret**
   添加 `KEYSTORE_BASE64`（把你本地的 `*.jks` 用 `base64 -w0 xxx.jks` 转成单行）。
2. 再加 `KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD` 三个 secret。
3. 把 workflow 里 `assembleDebug` 改为 `assembleRelease` 并加签名配置即可（需要再告诉我，我帮你改 workflow）。

---

## 常见问题
- **Actions 构建失败「SDK not found」**：确认 workflow 里 `sdkmanager "platforms;android-34"` 步骤成功（首次可能要接受 license，已用 `yes | sdkmanager --licenses` 处理）。
- **`npm ci` 报错**：仓库里必须含 `package-lock.json`（已存在）。若你手动改过 `package.json` 依赖，先在本地 `npm.cmd install` 更新 lock 再 push。
- **手机装不上 APK**：检查「未知来源」权限是否开启；或换用路线 B 的 release 包。
- **改了代码没生效**：本机改完务必 `git push` 触发重新构建；路线 B 需先 `cap sync android` 再 Build。
