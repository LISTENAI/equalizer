/**
 * 注册全局组件
 */

import SvgIcon from './SvgIcon.vue';
import 'virtual:svg-icons-register';

const components = [SvgIcon];

export default {
  install(app) {
    components.map(component => {
      app.component(component.name, component);
    });
  }
};
