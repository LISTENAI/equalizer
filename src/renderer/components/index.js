/**
 * 注册全局组件
 */

import SvgIcon from './SvgIcon';

const components = [SvgIcon];

export default {
  install(app) {
    components.map(component => {
      app.component(component.name, component);
    });
    const req = require.context('../assets/svg', false, /\.svg$/);
    const requireAll = requireContext =>
      requireContext.keys().map(requireContext);
    requireAll(req);
  }
};
