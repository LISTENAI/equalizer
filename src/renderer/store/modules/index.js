/**
 * The file enables `@/store/index.js` to import all vuex modules
 * in a one-shot manner. There should not be any reason to edit this file.
 */

const modules = {};
const files = import.meta.glob('./*.js', { eager: true });

Object.keys(files).forEach((key) => {
  if (key.endsWith('index.js')) return;
  const name = key.replace(/(\.\/|\.js)/g, '');
  modules[name] = files[key].default;
});

export default modules;
