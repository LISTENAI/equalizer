# LSAudio 发布维护

仓库保持公开；通过验收的 Release 可公开下载，草稿仍仅供维护者检查。发布任务检查仓库可见性为 public。产品标识 `listenai.com`、名称 `LSAudio` 和 Electron 用户数据目录保持不变。不接入在线更新。

## 工作流

1. 功能 PR：四个平台原生 runner 执行 C 回归、音频测试、应用目录启动测试。Windows 额外与原 DLL 现场对照。测试失败不可通过放宽数值容差绕过。
2. 版本 PR：在干净工作区运行 `npm run release:prepare -- 1.2.0-beta.1`，填写中文 `CHANGELOG.md`，运行 `npm run release:verify`。提交 package.json、package-lock.json 和更新日志。请维护者审查并合并到 master。
3. 合并检查通过后，发布执行者（本任务已授权的代理或维护者）检出最新 master，运行 `npm run release:tag -- 1.2.0-beta.1`。工具核对 master HEAD、四平台检查、已审查版本 PR，然后创建并推送不可移动的 `v1.2.0-beta.1` 标签到 **github** 远端。保留原 origin；不向 origin 发布。
4. 标签触发 `Release installers`，重新测试、构建和验证全部五个安装器。构建使用 `--publish never`、只读 token。全部目标成功后，汇总任务才创建草稿；附带五个安装器、`SHA256SUMS.txt`、`build-manifest.json`。
5. 从草稿下载实际附件，完成[验收记录](../releases/acceptance/README.md)。验收绑定标签提交和构建清单散列；实机未验证必须保持 pending。审查验收记录并合并到 master 后，`Publish accepted release` 自动发布草稿。beta 为 prerelease 且不设 Latest；稳定版设 Latest。

初次版本为 `1.2.0-beta.1`。完成预览版验收后，用同一流程准备 `1.2.0`，不复用 beta 标签。

标签步骤使用 GitHub CLI 登录凭据对应的 Git 推送，不使用 Actions 的 GITHUB_TOKEN 推送标签，避免 GitHub 的递归触发保护导致发布工作流不启动。代理会在版本 PR 审查、合并、检查门槛满足后执行，不需要再次确认标签/发布权限。

## 版本边界

- `package.json` 是产品版本唯一来源，lockfile 根版本必须一致。界面版本由构建工具注入 preload；安装器和产物名由 builder 注入版本。
- `.lsaudio` 中的 `manifestJson.version` 是工程修订计数，不随产品发版重置。
- C ABI/模块版本在 native 中管理；FFmpeg 的实际版本按目标记录在 `ffmpeg/manifest.json`，不能把资源合集的 b6.1.1 当成全部平台实际版本。
- 接受标签 `vX.Y.Z` 或 `vX.Y.Z-beta.N`，保留历史标签。不覆盖已发布附件，不移动标签。修复用新版本。

## 平台和产物

| 原生 runner | 文件后缀 | 签名状态 |
| --- | --- | --- |
| Windows x64 | `-windows-x64-setup.exe` | 未签名 |
| macOS x64 | `-macos-x64.dmg` | ad-hoc；无 Developer ID、无公证 |
| macOS arm64 | `-macos-arm64.dmg` | ad-hoc；无 Developer ID、无公证 |
| Linux x64 | `-linux-x64.AppImage`、`-linux-x64.deb` | 未签名 |

文件名前缀为 `LSAudio-<version>`。构建清单包括提交、Actions run、Node/Electron/builder/CMake、FFmpeg 版本来源、散列、签名状态。macOS 签名会改变 dylib 字节，签名后重新生成 native 清单，再签外层应用并验证。

## 演练与排错

在 Actions 手动运行 `Release installers`（可选择分支），仅产生构建产物，不创建标签或 Release。实现分支与 `codex/release-*` 版本分支的 push 也执行演练，便于在合并前验证安装器；均不创建 Release。

本机 `npm run electron:build` 使用本机平台/架构，C 库禁止跨宿主误用；输出在 dist。`npm run electron:build -- --dir` 后运行 `npm run test:app`。`test:installers` 仅允许在可丢弃的 CI runner 执行，避免改动开发机安装。Linux 使用 `xvfb-run -a`。

任一目标失败均不创建 Release。保留失败日志/截图 7 天；Actions 存储配额不足会明确失败，不能跳过上传宣称发布验证完成。资源缺失、架构错误在启动时给出明确提示。

同标签重跑仅允许同提交的草稿，重新汇总完整附件。草稿附件变动意味着必须重新取得验收散列；已发布版本一律拒绝更新。

安装器测试涵盖 NSIS 安装/卸载、DMG 挂载复制后启动、AppImage 提取运行和 deb 安装后运行。AppImage 在容器中通过自解压方式启动，FUSE 桌面使用和系统安装提示仍须验收。Windows 真实 1.1.4 升级基线、听感、设备参数和串口音频收发不可用单元测试代替。

## 首次发布跟踪

- 自动测试结果以功能 PR 的最新提交 CI 为准，不以旧提交成功状态放行。
- 尚未取得物理设备和完整安装验收结果前，平台表保持“待发布验收”。
- 首次发布需要仓库成员审查合并版本 PR；代理不会自行冒充审查者。
