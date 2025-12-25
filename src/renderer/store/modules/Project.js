import { defineStore } from 'pinia';

export const useProjectStore = defineStore('Project', {
  state: () => ({
    project: {}, //项目信息
    params: {}, //界面参数
    reset: false, //打开新项目之后是否重置界面参数
    rate: 48000, //默认采样率
    fsMutex: false, //采样率修改是否重置界面参数
    connect: false, //是否连接固件
  }),
  actions: {
    saveProject(data) {
      this.project = data;
    },
    saveParams(data) {
      this.params = data;
    },
    changeReset(data) {
      this.reset = data;
    },
    changeFsReset(data) {
      this.fsMutex = data;
    },
    changeRate(data) {
      this.rate = data;
    },
    changeConnect(data) {
      this.connect = data;
    },
  },
});
