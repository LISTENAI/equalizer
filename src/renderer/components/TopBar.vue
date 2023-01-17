<template>
  <div class="top-bar flex">
    <div class="logo"></div>
    <div class="top-menu flex">
      <div v-for="(menu, index) in menus" :key="index" class="top-menu-item">
        <span
          @click="
            () => {
              menu.cb && menu.cb();
            }
          "
          >{{ menu.label }}</span
        >
        <ul v-if="menu.children" class="top-menu-item-child">
          <li
            v-for="(child, index) in menu.children"
            :key="index"
            @click="child.cb(child.data)"
          >
            {{ child.name }}
          </li>
        </ul>
      </div>
    </div>
    <div class="operate-bar flex">
      <div class="icon" @click="min">
        <svg-icon icon-class="win_min"></svg-icon>
      </div>
      <div class="icon" @click="max">
        <svg-icon :icon-class="isMax ? 'win_max' : 'win_resize'"></svg-icon>
      </div>
      <div class="icon close" @click="close">
        <svg-icon icon-class="r_cross"></svg-icon>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TopBar',
  computed: {},
  data() {
    return {
      version: '1.0.0',
      menus: [
        {
          label: '文件',
          children: [
            {
              name: '新建',
              // cb: this.toCreate,
            },
            {
              name: '打开',
              // cb: this.toOpen,
            },
            {
              name: '保存',
              // cb: this.toSave,
            },
            {
              name: '另存为',
              // cb: this.toSave,
            },
          ],
          cb: null,
        },
        {
          label: '关于',
          cb: this.showInfo,
        },
      ],
      isMax: false,
    };
  },
  methods: {
    max() {
      this.isMax = !this.isMax;
      this.$electron.ipcRenderer.send('window-max');
    },
    min() {
      this.isMax = false;
      this.$electron.ipcRenderer.send('window-min');
    },
    close() {
      this.$electron.ipcRenderer.send('window-close');
    },
    menuCick(menu) {
      console.log(menu);
    },
    getInfoHtml() {
      return `
        <div class="info-content">
          <img src="@/assets/imgs/drc.png" alt="" class="logo" />
          <p>聆思音频下行工具</p>
          <p>${this.version}</p>
        </div>
        `;
    },
    showInfo() {
      const Dom = this.getInfoHtml();
      this.$alert(Dom, '关于', {
        dangerouslyUseHTMLString: true,
        showConfirmButton: false,
        customClass: 'info-box',
        callback: (action) => {},
      });
    },
  },
};
</script>

<style scoped lang="scss">
.top-bar {
  background-color: $grey7;
  width: 100%;
  height: 30px;
  align-items: center;
  color: #808080;
  padding: 0 8px;
  box-sizing: border-box;
  -webkit-app-region: drag;

  .logo {
    -webkit-app-region: no-drag;
    width: 16px;
    height: 16px;
    background: #d8d8d8;
    border-radius: 50%;
    margin-right: 8px;
  }
  .top-menu {
    &-item {
      position: relative;
      cursor: pointer;
      height: 30px;
      line-height: 30px;
      padding: 0 8px;
      -webkit-app-region: no-drag;
      &-child {
        position: absolute;
        left: 0;
        top: 32px;
        display: none;
        width: 144px;
        background-color: $grey7;
        box-shadow: 0px 3px 9px 0px rgba(0, 0, 0, 0.75);
        z-index: 9999;
        border-bottom: 0px;
        &::before {
          position: absolute;
          display: block;
          width: 0;
          height: 0;
          border-color: transparent;
          border-style: solid;
          content: ' ';
          border-width: 6px;
          top: 1px;
          margin-left: -6px;
          border-top-width: 0;
          top: -6px;
          left: 6px;
          border-bottom-color: $grey7;
        }
        & li {
          cursor: pointer;
          text-align: left;
          height: 28px;
          line-height: 28px;
          padding: 0 12px;

          &:hover {
            background: rgba(255, 255, 255, 0.05);
          }
        }
      }

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        & .top-menu-item-child {
          display: block;
        }
      }
    }
  }
  .operate-bar {
    margin-left: auto;
    -webkit-app-region: no-drag;
    .icon {
      width: 30px;
      height: 30px;
      text-align: center;
      line-height: 30px;
      cursor: pointer;
      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      &.close:hover {
        background-color: $danger;
      }
    }
  }
}
</style>
