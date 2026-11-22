# 练耳训练 · Android 打包工程

本工程用 **Capacitor** 把 `www/` 里的网页包成 Android App，并用 **GitHub Actions** 在云端自动编译出 `.apk`。

## 目录说明

- `www/` — 网页应用本体（练耳 App 的全部代码）
- `capacitor.config.json` — App 包名 / 名称 / 资源目录
- `package.json` — Capacitor 依赖
- `.github/workflows/build-apk.yml` — 云端自动编译脚本

## 如何得到 APK（你只需做 4 步）

1. 在 GitHub 新建一个仓库（**不要**勾选 README），把本工程里的**所有文件**上传进去（注意要包含 `.github` 这个文件夹）。
2. 上传完成后，GitHub 会自动开始编译（点仓库顶部的 **Actions** 标签能看到进度）。
3. 等编译完成（绿色 ✓，约 3–5 分钟），点进这次运行 → 最下面 **Artifacts** 里下载 **ear-trainer-apk**（一个 zip）。
4. 解压得到 `app-debug.apk`，传到手机安装（需允许“安装未知来源应用”）。

> 首次安装的是 debug 签名版，仅供自用，完全可正常安装运行。
