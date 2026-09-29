# eqdrawDLL 包装层还原记录

## 来源与范围

- 原文件：`dlls/x64/eqdrawDLL.dll`。
- SHA-256：`10637abceb023b57211ca4865ad0897015107082a554095afddc426dce95b74c`。
- 原依赖：`iflytekEqDrcDrawApi.dll`，SHA-256 为 `36439ac158a3c6f39ba3ebcbe6ca0316cc72d298caa56f949caf9a0e94957a83`。
- 已实现全部四个导出：`eqDrawPoints`、`drcDrawPoints`、`freePoints`、`freeDrcPoints`。
- 方法：原 DLL 导入表、反汇编、原头文件和独立 Koffi 进程对照。原包装层只从算法库导入 `EqDraw`、`DrcDraw`、`EqCalcXToFreq`、`DrcCalcXToDb`，不导入 `SoundEffect.dll`。

新模块位于 `native/modules/eqdraw/`，生成 `lsaudio_eqdraw` 动态库，链接已经还原的 `lsaudio_eqdrc`，不链接任何原厂 DLL。原文件保留用作基准。共享库的符号导出宏分离，避免 Windows 把核心导入函数误声明为包装层导出函数。

## 返回结构与调用契约

| 结构 | 大小 | 字段偏移 |
| --- | ---: | --- |
| `eqDrawResult` | 16392 字节 | ret=0，arr_size=4，points=8；1024 对 double |
| `drcDrawResult` | 5144 字节 | ret=0，arr_size=4，dot_size=8，points=16；315 对 double；fs=5056，dots=5060 |

布局有 C 编译期断言；不使用 packed 结构。头文件是 `include/lsaudio/eqdraw.h`。

EQ 包装层先用清零的临时数组调用 `EqDraw`。成功时返回 xNum 个 `[EqCalcXToFreq(i), y[i]]`；失败时 ret 为原错误码，arr_size=0。关闭 EQ 时，点数和频率坐标仍返回，纵坐标为 0。`startFreq=0` 的 UI 修改也会传播给调用方，包括 EQ 已关闭、由坐标转换执行修改的情况。

DRC 包装层成功时返回 WidthX 个 `[DrcCalcXToDb(i), y[i]]`，坐标和曲线从 float 提升为 double。fs 及控制点取自 `DrcDraw` 返回的修正结构，但 **dot_size 是原输入 SegNum+1**。例如关闭 DRC、输入 SegNum=0 时，核心会修正到 1 段，包装层仍只返回一个控制点。失败时 ret 为原错误码，arr_size/dot_size 均为 0。

原头文件的 `drcDrawPoints` 按值接收 `struDrcPrm`。本模块保留这个声明。Windows x64 ABI 用隐藏指针传递这个大结构体，因此项目当前的 Koffi 指针声明恰好可用；不能据此把指针声明移植到其他架构。新对照采集器使用完整的 Koffi 结构体按值声明，并在 Windows x64 上额外验证现有指针调用方式的结果一致。EQ 参数仍按指针传入。

返回对象由调用方拥有，必须用分配它的那个动态库导出的释放函数释放。两种释放函数均接受 NULL。新实现分配失败返回 NULL；调用方需要在解码前检查它。

## 有意修复的缺陷

原包装层用 malloc 分配临时 y 数组，在成功和错误路径都未释放；两个 free 函数只释放最终返回对象。新实现使用有界栈数组作为临时空间，返回对象仍在堆上分配。

原包装层不检查结果数组容量，可能写越界。新实现对 EQ 负点数或超过 1024 返回 -12，对 DRC 负点数或超过 315 返回 -17；空 UI 分别返回 -11/-20。DRC SegNum 不在 0–6 时返回 -8，避免根据原始 SegNum 复制超过 7 个控制点。正常范围内继续执行核心校验。核心已有的安全拒绝行为（例如启用 EQ 的单点图、非有限参数）继续适用。

原返回结构中，未用的数组空间、对齐填充和错误情况下的 fs/dots 未初始化。基准采集器只读取已定义的字段，不读取或保存这些内存。新实现把整个返回对象清零，提供确定性的剩余字段。测试不把原 DLL 的随机堆内容当作兼容要求。

空 UI、负尺寸、超过容量等可能导致原 DLL 崩溃或越界的调用，只在新 C 实现中测试；不在原库批量采集中执行。多项错误并存且触发新增容量检查时，返回优先级可能不同于原库的未定义行为。

## 测试与复现

```sh
npm run native:build
npm run native:test                 # 核心和包装层，读取固定基准，不加载原 DLL
npm run native:compare              # Windows x64：两个模块都与现场原 DLL 对照
npm run native:compare -- eqdraw    # 仅包装层差分；仍构建全部模块并运行全部 CTest
npm run native:capture -- eqdraw    # 显式更新包装层原 DLL 基准
```

包装层用例复用核心的滤波器/DRC 参数网格，并剔除原包装层不安全的调用，补充 840/1023/1024 个 EQ 点、314/315 个 DRC 点、关闭 EQ 的零起始频率，以及原始与修正 DRC 段数不同的情况。用例来源文件、采集器和原包装层/算法库的散列一起记录在 fixture 中。

Windows x64 / MSVC Release 实测：442 组包装层用例（347 EQ、95 DRC，包含 53 组错误返回），33,112 个点的 X/Y 最大误差均为 0，12 个非有限值分类一致。整数、采样率、控制点、参数/UI 修改精确比较。浮点回归阈值：EQ X 为 `1e-10 * max(1, abs(reference))`，EQ Y 为 1e-8，DRC 为 2e-5。并非承诺所有平台逐位相同。

额外 C 测试覆盖两个结果结构的边界、1025/316/INT_MAX 请求、空参数、未用空间清零、按值参数不变性，以及 2000 轮分配/释放。重复调用测试不是堆泄漏检测器；临时分配问题通过移除临时堆分配路径解决。

## 应用接入边界

本轮未切换 `src/libs/capi.js` 的加载路径。后续接入时需要一起处理：

1. 根据平台加载新库，并一起部署核心依赖库；macOS/Linux 的包装库使用相邻库相对搜索路径。
2. 将 DRC FFI 声明改为真实按值结构体，加入返回 NULL 检查。
3. 当前 `src/libs/stru.js` 的 EQ 返回数组声明是 840，而原/新 C ABI 容量均为 1024；接入时应统一容量，同时保留 UI 默认点数作为独立配置。
4. `SoundEffect.dll` 已在相邻 soundeffect 模块还原，但应用尚未切换这三个库，也未完成 FFmpeg/打包配置的平台适配。macOS/Linux/ARM64 尚未运行验证。
