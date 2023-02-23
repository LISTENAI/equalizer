const state = {
  project: {}, //项目信息
  params: {}, //界面参数
  reset: false,//打开新项目之后是否重置界面参数
  rate: 48000, //默认采样率
  fsMutex: false//采样率修改是否重置界面参数
};

const mutations = {
  SAVE_PROJECT(state, val) {
    state.project = val;
  },
  SAVE_PARAMS(state, val) {
    state.params = val;
  },
  CHANGE_RESET(state, val) {
    state.reset = val;
  },
  CHANGE_FSRESET(state, val) {
    state.fsMutex = val;
  },
  CHANGE_RATE(state, val) {
    state.rate = val;
  },
};

const actions = {
  saveProject({ commit }, data) {
    commit('SAVE_PROJECT', data);
  },
  saveParams({ commit }, data) {
    commit('SAVE_PARAMS', data);
  },
  changeReset({ commit }, data) {
    commit('CHANGE_RESET', data);
  },
  changeFsReset({ commit }, data) {
    commit('CHANGE_FSRESET', data);
  },
  changeRate({ commit }, data) {
    commit('CHANGE_RATE', data);
  }
};

export default {
  state,
  mutations,
  actions
};
