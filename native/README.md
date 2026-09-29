# Native C 源码维护区

本目录统一维护逐步替代预编译库的 C 实现、构建入口、原 DLL 对照用例和还原记录。`eqdrc` 实现 `iflytekEqDrcDrawApi.h` 的 13 个公开函数，`eqdraw` 实现包装层全部 4 个导出，`soundeffect` 实现音频库全部 9 个导出，各自都有原 DLL 对照测试。Electron 仍使用原 DLL；新库名为 `lsaudio_eqdrc`、`lsaudio_eqdraw` 和 `lsaudio_soundeffect`。原绘图算法 DLL 另有未在头文件声明的 DSP/CMSIS 导出，当前不承诺完整替代其全部 40 个导出符号。

## 目录约定

```text
native/
  CMakeLists.txt                所有 C 模块的构建入口
  common/biquad.c               绘图和音频共用的系数计算，分别编入各库
  modules/
    eqdrc/
      CMakeLists.txt
      include/lsaudio/eqdrc.h   已实现的公开 ABI / 新增严格接口
      src/                     可移植 C11 实现
      RECONSTRUCTION.md        已验证行为、范围及下一步
    eqdraw/
      include/lsaudio/eqdraw.h  点数组及分配/释放 API
      src/eqdraw.c             调用 eqdrc 的包装层
      RECONSTRUCTION.md        布局、ABI 与安全差异
    soundeffect/
      include/lsaudio/soundeffect.h  实例、PCM 与 limiter API
      src/soundeffect.c        有状态的音频处理链
      src/tables.inc           用数学公式生成的定点近似查表
      RECONSTRUCTION.md        PCM、状态和数值兼容记录
  tests/
    eqdrc/
      bin_test.c               不依赖 Node 或原 DLL 的 C 测试
      draw_test.c              曲线契约及安全边界测试
      cases.cjs                独立测试输入定义
      observe.cjs              在独立进程中调用指定库
      fixtures/reference.json  原 DLL 输出，提交到版本控制
      compat.test.cjs          新实现与基准的差分断言
      check-live.cjs           确认原 DLL 基准可重复
    eqdraw/                    包装层 C 测试、对照用例和独立 fixture
    soundeffect/               音频 C 测试、连续帧场景和独立 fixture
  tools/run.cjs                从 npm / 命令行使用的统一入口
  tools/vendor-cmsis.cjs       显式更新固定版本的 FFT 源码子集
  tools/generate-sound-tables.cjs  显式重新生成数学查表
  third_party/cmsis-dsp/       FFT 源码、系数表、许可及来源散列
  build/                       CMake 产物，忽略、不提交
  artifacts/                   当次实验输出，忽略、不提交
```

原始头文件、DLL、LIB、PDB 保留在仓库现有的 `dlls/` 目录，作为研究参考。不得向那里写入新构建产物。

## 环境与命令

需要 CMake 3.20+ 和支持 C11 的编译器：Windows 使用 Visual Studio 2022 的 C++ 桌面开发工具链；macOS 使用 Apple Clang；Linux 使用 GCC 或 Clang。CMake 默认选择本机工具链，也可先手动配置 `native/build` 指定生成器。JS 对照工具需要 Node.js 20+ 及项目现有的 `koffi` 依赖。

在项目根目录运行：

```sh
npm run native:configure  # 仅配置 CMake
npm run native:build      # 配置并构建 Release
npm run native:test       # 重新构建、CTest、基于已保存 DLL 输出的差分测试
npm run native:capture    # 仅 Windows x64：重新采集原 DLL，更新已跟踪的 fixture
npm run native:compare    # 仅 Windows x64：构建、测试、再与现场原 DLL 对照
npm run native:compare -- eqdraw  # 只运行包装层差分；仍运行全部 CTest
npm run native:capture -- eqdraw  # 只重新采集包装层基准
npm run native:compare -- soundeffect  # 只运行音频差分；仍运行全部 CTest
```

日常开发用 `native:test`，默认测试三个模块，不会加载原 DLL，也不会更新基准。只有明确改变用例或原 DLL 版本时才运行 `native:capture`，并审查对应模块 `reference.json` 的差异。包装层与绘图核心共用部分输入；修改公共用例后要刷新受影响的两个基准。禁止用新实现的输出覆盖原 DLL 基准来消除失败。

`native:compare` 先验证新库与已保存的基准，再确认现场原 DLL 输出与基准完全一致。每次原生调用批次都运行在单独的 Node 子进程中，30 秒超时；加载失败、崩溃、超时或不一致均使命令失败。当前用例包含合法分配的缓冲区、已验证可处理的空参数；后续高风险探针应单独分进程执行。

仅运行 C 测试可不安装 Node 依赖：

```sh
cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Release
cmake --build native/build --config Release
ctest --test-dir native/build -C Release --output-on-failure
```

生成的动态库统一位于 `native/build/lib/`：Windows 为 `lsaudio_<module>.dll`，macOS 为 `liblsaudio_<module>.dylib`，Linux 为 `liblsaudio_<module>.so`。eqdraw 依赖 eqdrc，部署时需一起提供；soundeffect 独立编译，不依赖原厂库或绘图库。当前已在 Windows x64 / MSVC 实测；macOS、Linux 和 ARM64 仍需在对应环境运行上述命令，不能据此宣称整个应用已经跨平台。JS 对照工具按小端布局构造输入，DRC 包装接口使用真正的按值结构体声明；C 文件编解码显式处理小端格式。

## 后续模块的维护规则

1. 每个功能模块放在 `modules/<name>/`，由顶层 CMake `add_subdirectory` 纳入；测试放在 `tests/<name>/`。可执行测试用 CTest 注册，对照工具统一接入 `tools/run.cjs`。
2. 核心代码使用 C11、固定宽度整数和显式文件格式，不依赖 Electron、Koffi、Windows 头文件或 Debug CRT。JS 仅负责测试驱动及将来的应用适配。
3. 公开结构的大小、关键偏移应有编译期断言；导出 API 与内部辅助函数分开。尚未还原的 API 不导出成功返回的占位实现。
4. 每个结论先增加可重复用例，采集原 DLL，再实现并比较。字节格式要求精确一致；浮点算法明确记录容差，不能随意扩大容差掩盖偏差。
5. 旧接口兼容缺陷时写明原因，并为新调用方提供明确的安全语义。当前严格二进制解码与旧文本模式文件读入就是两个独立契约。
6. 新增平台适配、WASM 构建或应用切换时放在对应边界，不把平台逻辑混入算法。只有相关 API 达到覆盖要求后再修改 `src/libs/capi.js`。

当前范围与发现见 [eqdrc 还原记录](modules/eqdrc/RECONSTRUCTION.md)、[eqdraw 还原记录](modules/eqdraw/RECONSTRUCTION.md) 和 [soundeffect 还原记录](modules/soundeffect/RECONSTRUCTION.md)。
