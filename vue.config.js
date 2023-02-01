const path = require("path");
// const isProd = process.env.NODE_ENV === "production";

function resolve(dir) {
  return path.join(__dirname, dir);
}
module.exports = {
  lintOnSave: false,
  runtimeCompiler: true,
  productionSourceMap: true,
  css: {
    // css预设器配置项
    loaderOptions: {
      sass: {
        prependData: `@import "@/assets/scss/variable";`
      }
    }
  },
  chainWebpack: config => {
    config.resolve.alias
      .set("@", resolve("src/renderer"))
      .set("components", resolve("src/renderer/components"));
    config.module
      .rule('images')
      .use('url-loader')
      .loader('url-loader')
      .tap(options => Object.assign(options, {
        limit: 10240
      }));

    // 设置svg
    const svgRule = config.module.rule('svg');
    svgRule.uses.clear();
    svgRule
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      });
  },
  // webpack的相关配置
  configureWebpack: {
    entry: "./src/renderer/main.js",
    // resolve: {
    //   extensions: [".js", ".vue", ".json", ".ts", ".sass"],
    // },
    // // 公共资源合并
    // optimization: {
    //   splitChunks: {
    //     cacheGroups: {
    //       vendor: {
    //         chunks: "all",
    //         test: /node_modules/,
    //         name: "vendor",
    //         minChunks: 1,
    //         maxInitialRequests: 5,
    //         minSize: 0,
    //         priority: 100,
    //       },
    //       common: {
    //         chunks: "all",
    //         test: /[\\/]src[\\/]js[\\/]/,
    //         name: "common",
    //         minChunks: 2,
    //         maxInitialRequests: 5,
    //         minSize: 0,
    //         priority: 60,
    //       },
    //       styles: {
    //         name: "styles",
    //         test: /\.(sa|sc|le|c)ss$/,
    //         chunks: "all",
    //         enforce: true,
    //       },
    //       runtimeChunk: {
    //         name: "manifest",
    //       },
    //     },
    //   },
    // },
  },

  pluginOptions: {
    // 这里是electronbuild的配置信息
    electronBuilder: {
      // 这里是在浏览器中使用node环境，需要为true
      nodeIntegration: true,
      externals: ['serialport', 'ffi-napi', 'ref-napi'],
      builderOptions: {
        productName: 'equliazer',
        appId: 'listenai.com',
        copyright: 'listenai',
        compression: 'store', // "store" | "normal"| "maximum" 打包压缩情况(store 相对较快)，store 39749kb, maximum 39186kb
        directories: {
          // output: 'build' // 输出文件夹
        },
        win: {
          icon: './public/LSAudio256.ico',
          target: ['nsis', 'zip']
        },
        mac: {
          target: { target: 'dir', arch: 'arm64' }
        },
        nsis: {
          oneClick: false, // 一键安装
          // guid: 'xxxx', // 注册表名字，不推荐修改
          perMachine: true, // 是否开启安装时权限限制（此电脑或当前用户）
          allowElevation: true, // 允许请求提升。 如果为false，则用户必须使用提升的权限重新启动安装程序。
          allowToChangeInstallationDirectory: true, // 允许修改安装目录
          installerIcon: './public/LSAudio256.ico', // 安装图标
          // uninstallerIcon: './build/icons/bbb.ico', // 卸载图标
          installerHeaderIcon: './public/LSAudio256.ico', // 安装时头部图标
          createDesktopShortcut: true, // 创建桌面图标
          createStartMenuShortcut: true, // 创建开始菜单图标
          shortcutName: 'equliazer' // 图标名称
        }
      }
    },
    'style-resources-loader': {
      preProcessor: 'sass',
      patterns: [path.resolve(__dirname, 'src/sass/index.scss')] // 引入全局样式变量
    }
  }
};
