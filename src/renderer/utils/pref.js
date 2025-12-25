export const PREF_KEYS = {
  AUTO_FETCH_PARAMS_ON_CONNECT: 'auto_fetch_params_on_connect',
  LAST_BAUDRATE: 'last_baudrate',
  LAST_SAMPLE_RATE: 'last_sampleRate',
};

export const getPref = (key, defaultValue = null) => {
  try {
    const val = window?.localStorage?.getItem(key);
    return val === null || val === undefined ? defaultValue : val;
  } catch (e) {
    return defaultValue;
  }
};

export const setPref = (key, value) => {
  try {
    window?.localStorage?.setItem(key, value);
  } catch (e) {
    // ignore write errors
  }
};

export const removePref = (key) => {
  try {
    window?.localStorage?.removeItem(key);
  } catch (e) {
    // ignore remove errors
  }
};

export const getPrefBool = (key, defaultValue = false) => {
  const val = getPref(key);
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'boolean') return val;
  return val === '1' || val === 'true';
};

export const setPrefBool = (key, value) => {
  setPref(key, value ? '1' : '0');
};

export default {
  PREF_KEYS,
  getPref,
  setPref,
  removePref,
  getPrefBool,
  setPrefBool,
};
