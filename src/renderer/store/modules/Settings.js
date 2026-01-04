import { defineStore } from 'pinia';
import { PREF_KEYS, getPrefBool, setPrefBool } from '../../utils/pref';

export const useSettingsStore = defineStore('Settings', {
  state: () => ({
    autoFetchParams: getPrefBool(PREF_KEYS.AUTO_FETCH_PARAMS_ON_CONNECT, false),
  }),
  actions: {
    setAutoFetchParams(val) {
      const next = !!val;
      this.autoFetchParams = next;
      setPrefBool(PREF_KEYS.AUTO_FETCH_PARAMS_ON_CONNECT, next);
    },
    toggleAutoFetchParams() {
      this.setAutoFetchParams(!this.autoFetchParams);
    },
  },
});
