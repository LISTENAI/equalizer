import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import Components from './components';
import Element from './element';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@/assets/scss/basic.scss';
import _ from 'lodash';

const app = createApp(App);
app.config.globalProperties._ = _;

app.use(Components);
app.use(Element);
app.use(router);
app.use(store);

app.mount('#app');
