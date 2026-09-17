# 人生重启 · AI Life Restart（Capacitor 个人版）

把「AI 人生重启 App」包装成 **Android APK 侧载自用**的工程（不上架应用商店）。
逻辑与原单文件 Web 版完全一致，额外接入：

- **Capacitor** 原生壳（WebView 加载 Web 产物）
- **@capacitor/preferences**：本地持久化（原生 KV，比 localStorage 更稳）
- **@capacitor/local-notifications**：白天随机时段一条「打断」本地通知（不需服务器）
- **导出 / 导入备份**：面板页可把全部数据导出为 JSON，换机/重装可恢复

## 目录结构
```
life-restart-app/
├─ index.html              # Vite 入口
├─ vite.config.js          # base:'./' 适配 WebView
├─ capacitor.config.json   # appId / appName / webDir
├─ public/
│  ├─ manifest.webmanifest # PWA 可安装
│  └─ icon.svg
└─ src/
   ├─ main.js              # 全部业务/UI 逻辑（含 aiHook 接入点）
   ├─ style.css
   ├─ store.js             # 存储抽象（Preferences / localStorage 降级）
   └─ notify.js            # 白天打断原生通知
```

## ⚠️ Windows 本机操作注意
本工程在 Windows 上构建 APK 时，请留意以下坑（已在沙箱内踩过并验证）：

- **PowerShell 默认禁止运行 `npm.ps1` / `npx.ps1`**（报 `PSSecurityError: 无法加载 npm.ps1`）。
  解决办法（任选其一）：
  - 用 `npm.cmd` / `npx.cmd`（`.cmd` 不受 ps1 执行策略限制），例如 `npm.cmd install`、`npx.cmd cap add android`；
  - 或直接 `node node_modules/@capacitor/cli/bin/capacitor add android` 跑 CLI 二进制；
  - 或在 **Git Bash / CMD** 里用 `npm` / `npx`（它们走 `.cmd` 包装，不受 ps1 限制）。
- **国内网络建议加镜像加速**依赖安装：
  `npm.cmd install --registry https://registry.npmmirror.com`
- 本 README 正文里的 `npm` / `npx cap` 命令，在 PowerShell 中请对应替换成 `npm.cmd` / `npm.cmd exec cap`（或 `npx.cmd cap`）。

## 本地预览（桌面调试）
```bash
npm install
npm run dev        # 打开提示的 http://localhost:5173
```
桌面调试时通知自动跳过（仅原生平台调度），其余功能一致。

## 构建 Web 产物
```bash
npm run build      # 输出到 dist/，base 为相对路径，WebView 下可直接加载
```

## 打包成 Android APK（侧载自用）
> 工程里已包含 `android/` 原生骨架（已在沙箱生成），你本机**无需**再执行 `cap add android`，直接 `cap sync` + `cap build` 即可。
> 构建 APK 需要 JDK 17 + Android SDK（装 Android Studio 最省事）。
> 沙箱环境没有 JDK/SDK，无法在此出包，故 deliver 到「骨架已生成、本机一键出包」这一步。

1. 装好 JDK 17 与 Android Studio（会自动带 Android SDK），并配好 `ANDROID_HOME` / `JAVA_HOME`。
2. 生成 Android 工程骨架（只需一次）：
   ```bash
   npm.cmd exec cap add android
   ```
3. 每次改完 Web 代码后同步：
   ```bash
   npm.cmd exec cap sync android
   ```
4. 出 APK：
   - 方式 A（命令行）：`npm.cmd exec cap build android`（会拉起 Gradle，产出 unsigned APK）
   - 方式 B（Android Studio，推荐，便于签名）：
     ```bash
     npm.cmd exec cap open android
     ```
     菜单 Build → Generate Signed Bundle / APK → APK → 用自己的密钥库签名。
5. 侧载安装：把 APK 传到手机，允许「未知来源」安装；或 `adb install app-release.apk`。

> 首次 `npm.cmd exec cap add android` 会生成 `android/` 目录（含默认启动图标）。
> 想换图标：替换 `android/app/src/main/res/mipmap-*` 或执行 `npx capacitor-assets generate`（需装 @capacitor/assets 并提供 `resources/icon.png` + `resources/splash.png`）。

## 数据 & 隐私
- 数据全部存在本机（Capacitor Preferences，沙盒内），不联网、不收集他人信息。
- 面板页 → **导出备份** 生成 JSON（可下载/复制/分享）；换机或重装后用 **导入备份** 恢复。
- 不上架、无自动更新：要更新就重新出 APK 装一遍。

## 白天打断通知
- 仅 Android 原生平台调度；首次进入每日循环会请求通知权限，并在当天随机时段排一条。
- 用户点通知打开 App 后，白天打断页会显示当天问题（与原逻辑一致）。
- Android 13+ 需要 `POST_NOTIFICATIONS` 权限（Capacitor 已声明，运行时弹窗请求）。

## 接入真大模型（可选）
默认提问/反馈走本地规则引擎（零成本、离线）。要接 OpenAI / Claude，只改 `src/main.js` 里的两处：
- `aiHook.genMorning(p, flags)` —— 每日问题
- `aiHook.genFeedback(p, e)` —— 晚间反馈

传入参数已含：反愿景、身份宣言、一年目标、魔王战、连续天数、是否断卡、昨天最小行动与回答摘要，符合产品提示词模板。可改为 `fetch` 你的后端（注意：纯前端直接放 API Key 不安全，建议走自建小后端或 Capacitor 配置注入）。

## iOS（可选，门槛高）
个人非商店分发在 iOS 上很麻烦：需 $99/年 Apple Developer 账号，走 Ad Hoc / TestFlight 或 Xcode 真机运行。
建议以 Android 为主；iOS 可后续用同一套 Web 代码加 `npm.cmd exec cap add ios` 再处理证书。
