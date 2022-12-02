import Vue from 'vue';
import axios from 'axios';
import App from './App';
import router from './router';
import store from './store';
import './element';
import Components from './components';
import '@/assets/scss/basic.scss';
// import * as echarts from 'echarts';
// import 'echarts/lib/chart/line'; // 折线图
// Vue.prototype.$echarts = echarts;
if (!process.env.IS_WEB) Vue.use(require('vue-electron'));
Vue.http = Vue.prototype.$http = axios;
Vue.config.productionTip = false;
Vue.use(Components);
/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  template: '<App/>'
}).$mount('#app');
