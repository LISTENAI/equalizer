# FFmpeg 资源与音频解码

应用内置 FFmpeg，用户无需安装，也不会在运行时下载。当前固定使用 `eugeneware/ffmpeg-static` 的 **b6.1.1** 发布产物，目标为 Windows x64、macOS x64/arm64、Linux x64。版本由 `manifest.json` 管理，不跟随 latest。

发布标签是资源包版本，并不表示每个二进制都运行 FFmpeg 6.1.1。原生 CI 实测的版本如下，清单分别锁定版本与文件 SHA，验证时要求二者都匹配：

| 平台 | 实际 FFmpeg 版本 |
| --- | --- |
| Windows x64 | 6.1.1 |
| macOS x64 | 6.1.1 |
| macOS arm64 | 6.0 |
| Linux x64 | 7.0.2 |

## 开发、验证与打包

```sh
npm run ffmpeg:prepare                  # 准备本机目标；npm run dev 会自动执行
npm run ffmpeg:prepare -- --all          # 准备四个目标
npm run ffmpeg:verify -- --all           # 校验 SHA、文件架构；本机目标额外运行 -version
npm run ffmpeg:prepare -- --platform darwin --arch arm64
npm run ffmpeg:smoke-pack -- --all       # 执行实际 afterPack 钩子并校验资源布局
```

缓存位于项目根目录 `.cache/ffmpeg/b6.1.1/<platform>-<arch>/`，不进入 Git。每份缓存包含可执行文件、LICENSE 和上游 README。压缩包、解压后的可执行文件和许可资料都有独立 SHA-256。下载先进入临时目录，所有校验通过才发布缓存；损坏的现有缓存明确报错，不自动绕过校验。

离线机器可以复制同目标的完整已验证缓存目录，或显式导入：

```sh
npm run ffmpeg:prepare -- --import /absolute/path/to/target-cache --offline
```

`--cache-root <directory>` 可指定工具使用的缓存根。开发应用仍从项目标准缓存读取；需要使用其他本地可执行文件时设置绝对路径 `FFMPEG_PATH`。正式包忽略这个覆盖值。设置 `LSAUDIO_FFMPEG_OFFLINE=1` 可禁止准备工具访问网络，缺缓存时给出明确错误。

`electron-builder` 的 `afterPack` 根据 **目标** 平台和架构选产物，不使用宿主架构替代；复制到安装包的 `resources/ffmpeg/`，包含 binary、LICENSE、README、build-info.json。macOS 使用 `Contents/Resources/ffmpeg/`，FFmpeg 已列入 `mac.binaries`，由原有签名流程处理。POSIX 文件设置 0755；二进制在 ASAR 外。每次打包只包含当前目标文件。

开发路径基于 `app.getAppPath()`，正式路径基于 `process.resourcesPath`，都不依赖当前工作目录。打包资源校验在签名前完成；macOS 签名修改可执行文件后，不应再直接与上游未签名文件的 SHA 比较。

## 统一解码接口

主进程通过 `openPcmSource(filePath)` 获取：

- `pcm`：16 kHz、单声道、s16le 的有背压可读流。
- `ready`：出现首批完整 PCM 采样后完成；启动失败、空音轨、取消时拒绝。
- `done`：进程关闭、输出结束且 PCM 被消费完后完成，结果为 completed/cancelled；解码失败时拒绝。
- `cancel()`：幂等，关闭输入/输出、终止子进程并等待退出；超过 1 秒升级为强制终止，再超过 1 秒返回明确错误。

普通文件使用参数数组和 `shell:false` 启动 FFmpeg，只取第一个音轨。`.pcm`（不区分大小写）按上述格式直接读取；奇数字节文件报错。无头 PCM 无法推断采样率和声道，其他格式的裸数据应先转换成标准 PCM 或带头的音频文件。

服务持续消费 stderr，只保存末尾 16 KiB，不记录每个音频块。错误包含可识别的 code、退出码和有界诊断。Electron 适配层把最近一次失败原子写入用户数据目录 `diagnostics/audio-last-error.json`；输入文件路径在 FFmpeg 诊断中替换为 `[input]`。

模块没有 Electron 或 DSP 依赖，可在纯 Node 环境测试。停止应用时会等待试听、串口和解码服务清理。`fluent-ffmpeg-7` 已移除。

## 业务消费者

试听采用最多 3200 个采样的软件队列，反压上游；DSP 固定接收 64 点帧，末尾补零但只播放有效采样。Buffer 转 Int16Array 使用准确偏移与长度。输出设备创建成功才回复播放成功；旧会话回调无法覆盖新会话。

音频设备库没有 drain 事件，因此自然结束会等待已提交缓冲区对应的时长，再留一个设备缓冲周期后释放；这不是硬件播放位置反馈。默认设备缓冲周期仍为 100 ms。

串口采用单个异步消费循环，按最多 1280 字节组帧，每帧等待对应端口/帧号的 ACK。尾部按真实长度发送，`0xf0/0xf1/0xf2` 协议保持不变，结束帧最多一次。ACK 超时仍为 1500 ms。取消或断开仅移除本次等待的监听器；两条音频链路独立运行。

`sp-send-audio-file`、`sp-cancel-audio-file` 现在直接通过 invoke 返回 `{code,message?}`，不再等待未发送的结果事件。`player-state` 与 `sp-update-audio-state` 保留 isPlaying，增加可选 message。开始后的异步错误通过状态事件显示。

## 测试与版本迁移

```sh
npm run test:audio                      # 无原生依赖的资源/服务/消费者测试
npm run test:audio:integration          # 本机实际 FFmpeg 与打包钩子
node tests/audio/device-smoke.mjs       # 可选：Windows x64、原 DSP、真实输出设备，会播放低音量短音
npm run build
npm run electron:build
```

设置 `FFMPEG_LEGACY_PATH` 为旧可执行文件的绝对路径，再运行 integration 测试，会在 `artifacts/audio/ffmpeg-migration.json` 生成迁移对照。首次迁移已对仓库原 FFmpeg 7.0 与新 6.1.1 执行对照：

| 夹具 | 旧/新采样数 | 不同采样数 | 最大差值 |
| --- | ---: | ---: | ---: |
| WAV、MP3、FLAC、OGG（分别验证） | 32137 / 32137 | 0 | 0 |
| AAC / ADTS | 33792 / 33792 | 0 | 0 |
| M4A / AAC | 32768 / 32768 | 0 | 0 |
| 44.1 kHz 双声道 → 16 kHz 单声道 | 16000 / 16000 | 0 | 0 |

这些结果针对受控夹具，不代表所有文件或所有平台的解码都逐位一致。有损格式按格式/时长/波形性质验收；RAW PCM、PCM WAV 和 FLAC 用例要求逐采样一致。

四目标二进制与许可文件均已在 Windows 主机下载、校验 SHA/架构，并通过目标资源布局冒烟检查。Windows 的 `electron-builder --dir --win --x64` 应用目录打包已通过，确认 FFmpeg 位于 resources 中且不在 ASAR 内。Windows 实际解码和 FFmpeg→原 SoundEffect→音频设备短音播放已执行。当前主机没有串口设备，真机发送尚未验证；已用模拟 ACK 验证慢确认、超时、取消、断开和尾帧。macOS/Linux 的实际执行及 macOS 签名需由对应环境验证。

`.github/workflows/audio.yml` 提供四个原生 runner 的独立音频验证，不需要 npm install、Electron 或 Windows DLL。它检查运行架构、资源准备、单元测试、实际解码和 afterPack 布局。工作流提交后在远端触发；本地检查不等同于远端 CI 已通过。

## 升级维护

显式运行 `node ffmpeg/update-manifest.cjs <release-tag> [versions.json]` 生成候选清单。工具要求四平台各项资源有上游 SHA-256；缺失即失败。仅在标签与二进制 SHA 均未变化时复用已有实际版本；新产物必须通过第二个参数提供已核实的版本映射，例如 `{"win32-x64":"6.1.1","darwin-x64":"6.1.1","darwin-arm64":"6.0","linux-x64":"7.0.2"}`。工具不再从发布标签猜测实际版本。审查地址、散列、版本和许可变化，重新执行四平台验证及迁移对照后再提交。正常构建只读取已提交清单，永不自动改版本。

本轮不切换还原的三个 native DLL，也不改其他原生依赖的打包筛选。整个应用的 macOS/Linux 发布仍需后续 native 后端接入；FFmpeg 模块的跨平台测试与此独立。
