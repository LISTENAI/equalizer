# SoundEffect.dll 音频处理还原记录

## 来源、产物与范围

原文件为 `dlls/x64/SoundEffect.dll`，SHA-256：`52aa6c35a4e07d65c76d191e645eee96bd2a81638a8c73c540219fbcf28dbc99`。依据是项目 Koffi 声明、播放器调用、原 DLL 反汇编和独立进程中的输入/输出实验。这里是兼容实现，不是恢复出的原始源码。

`native/modules/soundeffect/` 生成 `lsaudio_soundeffect`，实现全部九个导出：

| 接口 | 行为 |
| --- | --- |
| `IFLYTEK_AudioCreate` | 设置实例，返回所需 3508 字节 |
| `IFLYTEK_AudioInitial` | 初始化全部模块、默认参数和历史状态 |
| `IFLYTEK_AudioSet` | 按处理顺序设置各模块，保留部分更新语义 |
| `IFLYTEK_AudioGet` | 读回 360 字节音频参数 |
| `IFLYTEK_AudioProcess` | 处理 1–64 个 int32 槽位中的 PCM 采样 |
| `IFLYTEK_AudioReset` | 恢复指定模块 0–4 的默认参数 |
| `IFLYTEK_AudioDelete` | 结束使用；实例内存仍由调用方管理 |
| `IFLYTEK_AudioGetInfo` | 返回兼容版本字符串 |
| `IFLYTEK_SetAlgParam` | algorithm=5 时设置 limiter |

这个库不加载或链接任何原厂 DLL。滤波系数计算与绘图库共用 `native/common/biquad.c`，分别编入各自动态库；音频处理不调用 FFT 或绘图函数。其他模块仍有各自的完整差分回归。

## 实例与调用约定

调用方分配至少 3508 字节、按 uint32 对齐的缓冲区，依次调用 Create、Initial、Set、Process、Delete。原应用分配的 23552 字节也足够。新库内部没有逐帧堆分配；滤波、压缩和 limiter 的历史状态都保存在实例内，实例之间隔离。

新旧实例的内部布局不同，不能互换或序列化后跨库恢复；相同的是 API、公开参数格式和可观察行为。GetInfo 保留原 API 字符串 `iFlyTek Arcs Audio Process V2.1`，不代表新库是原厂二进制。

每个 PCM 采样放在 int32 槽位中。项目实际输入来自 s16le，播放器每次传 64 个采样；返回码 0 表示成功，不是输出采样数。支持输入输出指向同一缓冲区。最终增益可能输出超出 int16 的值，应用原来的 int16 截断/裁剪仍属于播放器；仅 limiter 启用时在库内裁到 -32768..32767。

处理顺序：低音增强 → 高音增强 → 10 段 PEQ → DRC → 增益 → 可选 limiter。

## 数值和状态细节

### 滤波与增益

滤波系数与绘图层一样包含明确的 float 舍入位置，但音频运算使用量化系数、64 位乘加和 32 位状态。每个模块还包含 Q14 输入/输出缩放，不能用普通 double biquad 替代。最大系数检测、postShift、截断和回绕均保留；用无符号运算明确表达回绕，避免 C 有符号溢出未定义行为。

Bass/Treble 使用固定 Q≈0.70710677 的低架/高架滤波器。增益使用 `powf(10, dB/20)` 后做 float 乘法、向零截断。转换超出 int32 范围时保留 x86 转换到 INT32_MIN 的可观察结果。

Set 成功时，滤波器状态按原库规则重置。参数校验也与绘图层不同：例如音频库允许 8000–48000 的采样率，关闭的 PEQ 滤波器跳过部分校验。Nyquist 或更高截止频率的原库结果同样保留，不能把它改为理想旁路后宣称兼容。

### DRC

音频 DRC 使用定点 dB、查表对数/指数、整数过渡区以及 Attack/Release 历史增益。它与静态绘图 DRC 的数值路径不同。

- 对数表由 `log(0.5+i/2048)` 先舍入到 binary32，再保留六位小数生成。
- 小数指数表由 `round(65535*exp(-i/256))` 生成。
- 整数指数表由 `round(65536*exp(i-5))` 生成。
- 生成脚本为 `native/tools/generate-sound-tables.cjs`。表来自数学公式，没有从 DLL 复制私有数据表或机器码；普通构建不运行生成器。
- RMS 模式经过校验后会改为 Peak，Get 也读回 Type=0；这是原 DLL 的实测行为。
- 重复 Set 或 Reset(DRC) 更新参数但保留历史增益；Initial 才整体重置状态。

原 DRC 包装器把一帧拆成 8 个等长子帧，因此非 8 倍数长度的尾部没有写入本阶段目标缓冲区。由于外层使用交替缓冲区，尾部保留的是 **PEQ 之前** 的值。新实现明确复现该路径，包括相应的滤波器状态更新；建议应用继续使用现有的 64 点帧。

### Limiter

项目当前只绑定 SetAlgParam，未从业务代码调用它。本轮仍还原了 algorithm=5 的 limiter，并增加独立对照用例。

从调用和内存访问推导出的 36 字节参数布局为：int32 enable，随后依次为 float lookahead_ms、sample_rate、threshold_db、knee_db、attack_ms、release_ms、ratio、makeup_db。头文件提供 `lsaudioLimiterPrm`。knee/ratio 虽被原库配置函数读取，但其实际 limiter 处理路径未使用它们。

前瞻环形缓冲、峰值跟踪、Attack/Release 平滑、makeup 和 int16 裁剪已实现。环形缓冲长度为 `max(1, ceil(lookahead_ms*0.001*sample_rate))`，实际延时为 length-1 个采样。重新配置 limiter 会清空其环形缓冲和历史增益，单独 Reset(GAIN) 则不重置 limiter。

## 错误和安全边界

Set 按 Bass、Treble、PEQ、DRC、Gain 顺序执行，遇到首个错误立即返回；之前成功的模块已经更新，后续保持旧值。测试精确比较失败后的 Get，避免误实现成全部成功或全部回滚。

新实现拒绝空必需指针、未 Create 的实例、不合法算法 ID、非有限参数和会超过 256 点 limiter 缓冲区的配置。原 DLL 在部分这些情况下可能越界或返回未定义结果；不复制这些行为。SetAlgParam 的非 5 算法 ID 明确返回 `LSAUDIO_SOUND_UNSUPPORTED (-1000)`；不把原库该分支未定义的返回寄存器当作兼容结果。

旧 ABI 没有实例或 PCM 缓冲区容量字段，调用方仍必须满足所需字节数。新库的额外校验不能保护任意无效地址。常规返回码、参数修改、副作用、原始 PCM 输出和正常缓冲区边界由对照用例验证。

## 验证与复现

```sh
npm run native:test -- soundeffect
npm run native:compare -- soundeffect  # Windows x64 原 DLL 现场对照
npm run native:capture -- soundeffect  # 显式更新原 DLL fixture，需审查差异
npm run native:compare                # 三个模块全部回归
```

Windows x64 / MSVC Release：396 组场景，7,224 帧、451,696 个 PCM 采样与原 DLL **逐整数完全一致**，容差为 0。覆盖默认初始化、旁路、脉冲、正弦、噪声、幅度阶跃、静音、int16 极值、增益范围、两种主要采样率的五类 EQ、Bass/Treble、DRC 多段/过渡/时间参数、组合链、1–64 范围内的多种帧长、原地处理、播放中 Set、分模块 Reset、重新 Initial、参数错误及 limiter 开关/延时/时序。

实例和 PCM 输出使用前后哨兵；采集器检查输入不被修改。额外 C 测试覆盖空指针、超长请求、limiter 容量、按实例保存的滤波历史和两个实例交错处理。版本、默认参数、所有步骤返回码以及参数读回均参与比较。以上结论针对这些用例，不是任意 PCM、配置和平台的等价证明。

应用仍加载原 DLL，本轮只完成 native 模块。macOS、Linux、ARM64 尚未运行验证。后续接入还需调整动态库加载、FFmpeg 平台路径和打包筛选，并运行实际试听与设备输出测试。
