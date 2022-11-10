<template>
  <div id="app">
    <TopBar/>
    <router-view></router-view>
  </div>
</template>

<script>
import TopBar from '@/components/TopBar.vue';
export default {
  name: 'equalizer',
  components: {
    TopBar
  }
}
</script>
<style lang="scss">
#app {
  background-color: $background;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: $semi-black;
  height: 100%;
  overflow: hidden;
  min-width: 800px;
}
</style>
