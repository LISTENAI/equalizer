const state = {
  project: {},
  params: {}
};

const mutations = {
  SAVE_PROJECT(state, val) {
    state.project = val;
  },
  SAVE_PARAMS(state, val) {
    state.params = val;
  },
};

const actions = {
  saveProject({ commit }, data) {
    commit('SAVE_PROJECT', data);
  },
  saveParams({ commit }, data) {
    commit('SAVE_PARAMS', data);
  }
};

export default {
  state,
  mutations,
  actions
};
