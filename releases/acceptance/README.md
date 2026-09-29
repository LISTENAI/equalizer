# 发布验收记录

每个待发布版本使用 `vX.Y.Z[-beta.N].json`，通过审查后合并到 master。合并触发发布流程；没有完整记录的草稿不会发布。不要将模板保存为版本 JSON，不要把无法测试的项目填为通过。

```json
{
  "tag": "v1.2.0-beta.1",
  "commit": "标签指向的完整提交 SHA",
  "manifestSha256": "从草稿下载的 build-manifest.json 的 SHA-256",
  "checks": {
    "windows-install-upgrade-uninstall": {"status":"pending","evidence":"","tester":"","date":""},
    "macos-x64-dmg": {"status":"pending","evidence":"","tester":"","date":""},
    "macos-arm64-dmg": {"status":"pending","evidence":"","tester":"","date":""},
    "linux-appimage-deb": {"status":"pending","evidence":"","tester":"","date":""},
    "actual-playback": {"status":"pending","evidence":"","tester":"","date":""},
    "device-parameter-read-write": {"status":"pending","evidence":"","tester":"","date":""},
    "device-audio-send": {"status":"pending","evidence":"","tester":"","date":""},
    "installation-prompts-known-issues": {"status":"pending","evidence":"","tester":"","date":""}
  }
}
```

通过时填写 `passed`、测试者、ISO 日期、具体日志/设备型号/操作结果。Windows 升级必须从提交 `a7f9381` 的真实 1.1.4 安装构建开始，验证工程和设置保留。模拟串口和静音输出测试只证明软件生命周期，不能代替实际试听、设备参数读写和音频发送。
