const state = {
  project: {},
  params: {},
  reset: false,
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
  }
};

export default {
  state,
  mutations,
  actions
};
