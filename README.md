# LSAudio 工具

## Native C 源码

预编译库的逐步还原、CMake 构建与原 DLL 对照测试统一维护在 [native/](native/README.md)。运行 `npm run native:test` 验证当前 C 实现，Windows x64 可运行 `npm run native:compare` 与原 DLL 现场对照。

## Project setup

```
npm run  install
```

### Compiles and hot-reloads for development

```
npm run dev
```

### Compiles and minifies for production

```
npm run  electron:build
```

打包生成的安装程序 LSAudio Setup 1.0.0.exe 在 dist_electron 文件夹下

### Lints and fixes files

```
npm run  lint
```

## [工具使用说明](./LSAudio%E5%B7%A5%E5%85%B7%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)
