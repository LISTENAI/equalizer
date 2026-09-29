<p align="center">
  <img src="public/icon.png" width="96" height="96" alt="LSAudio 图标">
</p>

<h1 align="center">LSAudio</h1>

<p align="center">
  <strong>面向音频设备的桌面调音客户端</strong><br>
  可视化调参 · 本地试听 · 串口同步 · 工程管理
</p>

<p align="center">
  <a href="https://github.com/LISTENAI/equalizer/actions/workflows/audio.yml">
    <img src="https://github.com/LISTENAI/equalizer/actions/workflows/audio.yml/badge.svg?branch=master" alt="音频与 FFmpeg CI">
  </a>
  <img src="https://img.shields.io/badge/Client-Windows%20x64-0078D4?style=flat-square" alt="客户端：Windows x64">
  <img src="https://img.shields.io/badge/UI-Electron%20%2B%20Vue%203-47848F?style=flat-square" alt="Electron 与 Vue 3">
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="./LSAudio%E5%B7%A5%E5%85%B7%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf">使用手册</a> ·
  <a href="#开发与测试">开发与测试</a> ·
  <a href="https://github.com/LISTENAI/equalizer/issues">问题反馈</a>
</p>

LSAudio 将音效参数编辑、曲线展示、音频试听和设备通信集中在一个桌面应用中。你可以管理调音工程，通过串口读取和写入兼容设备的参数，并用本地音频检查调整效果。

设备端需要实现本项目的串口通信协议；可用参数取决于设备固件支持的能力。

## 功能概览

| 能力 | 可以做什么 |
| --- | --- |
| **EQ 与 DRC** | 编辑 10 段参数均衡器、动态范围压缩参数，并查看对应曲线 |
| **音效调节** | 配置低音增强、高音增强、输出增益与旁路状态；识别设备是否支持啸叫等级 |
| **本地试听** | 播放本地音频，试听当前音效参数，支持停止、重播和播放中调参 |
| **设备同步** | 选择串口、校验设备连接、获取和写入参数，可启用连接后自动获取与自动生效模式 |
| **工程管理** | 新建、打开、保存和另存为 `.lsaudio` 工程，导入与导出 `.bin` 参数文件 |
| **设备音频调试** | 通过串口发送音频，并导出接收到的串口数据用于排查问题 |

本地试听支持 WAV、MP3、FLAC、AAC、M4A、OGG 和裸 PCM。音频处理与发送链路统一使用 **16 kHz、单声道、16 位小端 PCM**；这与调参界面可选择的设备采样率是两个不同的约定。裸 `.pcm` 文件应使用上述格式。

## 平台状态

| 组件 | Windows x64 | macOS x64 / arm64 | Linux x64 |
| --- | --- | --- | --- |
| 桌面客户端 | 当前运行与打包目标 | 适配中 | 适配中 |
| FFmpeg 与独立音频服务 | CI 验证 | CI 验证 | CI 验证 |
| C 算法替代实现 | 已通过原 DLL 对照测试 | 待运行验证 | 待运行验证 |

**当前请在 Windows x64 上运行完整客户端。** 音频 CI 覆盖资源校验、解码、流式处理与资源打包，不代表完整应用已经支持所有平台。桌面运行时仍使用原 Windows DLL，C 替代实现的接入工作正在推进。

## 快速开始

当前提供源码运行与本地打包方式。

### 开发环境

- Windows x64。
- Git、Node.js **22.12 或更高的 22.x 版本**及 npm，与音频 CI 使用的 Node.js 主版本一致。
- 首次安装依赖与准备 FFmpeg 时需要联网。
- 连接设备时，需要兼容固件和可用的串口；设备采样率应与调参界面保持一致。

```sh
git clone https://github.com/LISTENAI/equalizer.git
cd equalizer
npm ci
npm run dev
```

开发启动前会自动准备并校验本机的 FFmpeg。正式应用随包内置 FFmpeg，无需用户另行安装。离线准备、本地可执行文件覆盖和目标架构选择见 [FFmpeg 维护说明](ffmpeg/README.md)。

如需编译 C 算法替代实现，另需 **CMake 3.20+** 与 C11 编译器；Windows 推荐安装 Visual Studio 2022 的“使用 C++ 的桌面开发”组件。完整步骤见 [Native 开发指南](native/README.md)。

### 第一次调音

1. 新建或打开工程，选择与设备一致的采样率。
2. 选择串口并连接设备，获取当前参数。
3. 编辑 EQ、DRC 或其他音效参数，查看曲线并试听本地音频。
4. 将参数写入设备，保存工程或导出参数文件，便于后续复用。

界面操作与设备调试流程可参考 [工具使用手册（PDF）](./LSAudio%E5%B7%A5%E5%85%B7%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)。

## 构建应用

```sh
# 编译 Electron 主进程、预加载脚本与前端
npm run build

# 在 Windows x64 上构建客户端安装包
npm run electron:build
```

Windows 默认生成 NSIS 安装程序，产物位置以构建日志为准。打包时会按目标平台准备 FFmpeg，并附带对应的许可证与来源说明。

## 开发与测试

界面使用 **Vue 3、Element Plus 与 ECharts**，桌面层使用 **Electron 与 electron-vite**。串口通信和音频任务在主进程执行；FFmpeg 解码服务与 C 算法模块均有独立测试入口。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动桌面开发环境 |
| `npm run test:audio` | 运行音频服务、取消与错误处理、试听及串口消费逻辑的单元测试 |
| `npm run test:audio:integration` | 使用真实 FFmpeg 验证音频格式、重采样、离线缓存与资源打包 |
| `npm run ffmpeg:verify` | 校验本机 FFmpeg 的文件、架构和版本 |
| `npm run native:test` | 构建 C 模块，并与保存的原 DLL 输出基准比较 |
| `npm run native:compare` | 在 Windows x64 上与原 DLL 进行现场对照 |

音频单元测试和 FFmpeg 集成测试可以独立于 Electron、串口设备和原生音效 DLL 运行。[GitHub Actions](https://github.com/LISTENAI/equalizer/actions/workflows/audio.yml) 在四个目标平台执行这部分验证。设备协议使用模拟 ACK 测试；涉及真实串口或听感的改动仍需设备验证。

C 模块包括参数文件与曲线计算、绘图结果包装、实际音效处理。原 DLL 的行为基准用于检查数值精度、参数副作用和内存边界，具体兼容范围见各模块记录。

## 文档导航

| 文档 | 面向的任务 |
| --- | --- |
| [工具使用手册](./LSAudio%E5%B7%A5%E5%85%B7%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf) | 熟悉界面、工程与设备操作 |
| [FFmpeg 维护说明](ffmpeg/README.md) | 管理二进制版本、离线缓存、解码服务与跨平台打包 |
| [Native 开发指南](native/README.md) | 构建、测试和维护 C 算法模块 |
| [EQ / DRC 还原记录](native/modules/eqdrc/RECONSTRUCTION.md) | 理解参数文件格式与曲线算法的兼容行为 |
| [绘图包装层还原记录](native/modules/eqdraw/RECONSTRUCTION.md) | 了解点数组布局、调用约定与内存管理 |
| [音效处理还原记录](native/modules/soundeffect/RECONSTRUCTION.md) | 了解 PCM 处理、跨帧状态和 limiter 的验证范围 |

## 参与贡献

欢迎通过 [Issues](https://github.com/LISTENAI/equalizer/issues) 反馈问题，或提交 [Pull Request](https://github.com/LISTENAI/equalizer/pulls)。

- **报告问题**：注明操作系统与架构、应用版本或提交号、复现步骤和预期结果。设备问题请补充固件版本、采样率与串口配置；音频问题可附最小可复现样本或错误信息。
- **提交改动**：尽量围绕一个问题组织提交，说明行为变化，并运行与改动相关的测试。界面改动可附截图；协议或算法改动请补充回归用例。
- **维护资源**：FFmpeg 版本更新应包含来源、散列与各平台验证结果；原 DLL 对照基准应从原库重新采集并审查差异。

当前跨平台工作的重点是接入 C 算法替代实现，并完成 macOS/Linux 完整客户端的运行与打包验证。

## 许可证与第三方组件

仓库目前尚未提供项目级开源许可证。第三方组件遵循各自的许可条款：FFmpeg 的版本与许可随资源分发，CMSIS-DSP FFT 子集保留 Apache-2.0 许可证及上游来源记录。相关说明见 [FFmpeg 文档](ffmpeg/README.md) 与 [CMSIS-DSP 来源记录](native/third_party/cmsis-dsp/UPSTREAM.md)。
