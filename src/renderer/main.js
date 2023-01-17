import Vue from 'vue';
import axios from 'axios';
import App from './App';
import router from './router';
import store from './store';
import './element';
import Components from './components';
import 'element-ui/lib/theme-chalk/index.css';
import '@/assets/scss/basic.scss';
import * as electron from "electron";
import _ from 'lodash';
Vue.prototype._ = _;
Vue.http = Vue.prototype.$http = axios;
Vue.electron = Vue.prototype.$electron = electron;

Vue.config.productionTip = false;
Vue.use(Components);
/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  template: '<App/>'
}).$mount('#app');
