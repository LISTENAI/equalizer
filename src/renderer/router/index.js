import { createRouter, createWebHashHistory } from 'vue-router';

import Main from '@/pages/main.vue';

const routes = [
  {
    path: '/',
    name: 'landing-page',
    component: Main
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
