import Vue from 'vue';
import { Button, Select, Option, Checkbox, Dialog, InputNumber, Slider, MessageBox, Message, Radio } from 'element-ui';
Vue.use(Button);
Vue.use(Select);
Vue.use(Option);
Vue.use(Checkbox);
Vue.use(Dialog);
Vue.use(InputNumber);
Vue.use(Slider);
Vue.use(Radio);

Vue.prototype.$msgbox = MessageBox;
Vue.prototype.$alert = MessageBox.alert;
Vue.prototype.$confirm = MessageBox.confirm;
Vue.prototype.$message = Message;