# 随包第三方资料

- Electron：应用目录包含 Electron 的 LICENSE / LICENSES.chromium.html。
- FFmpeg：`resources/ffmpeg` 中包含当前平台的许可证、上游 README 和来源记录；实际版本与 SHA-256 见仓库 `ffmpeg/manifest.json`。
- CMSIS-DSP FFT 子集：`resources/licenses/CMSIS-DSP-LICENSE.txt` 与 `CMSIS-DSP-SOURCE.md`，Apache-2.0。
- JavaScript 与 Node 原生依赖：安装包中的依赖目录保留各包许可文件。包括 Koffi、serialport、@echogarden/audio-io（MIT）；具体依赖版本见 package-lock.json。
- LSAudio C 模块为本仓库维护的兼容实现；原厂 Windows DLL 仅为测试输入，不包含在安装包内。项目级许可状态以仓库声明为准，不因使用第三方开源组件而改变。
