<template>
  <div class="top-bar flex">
    <img class="logo" :src="require('@/assets/imgs/lsAudio.png')" />
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
    <ProjectModal
      :visible="projectModalVisible"
      @close="closeModal"
      @save="saveHandle"
    />
  </div>
</template>

<script>
import ProjectModal from './CreateProjectModal';
import { mapState } from 'vuex';

export default {
  name: 'TopBar',
  components: { ProjectModal },
  data() {
    return {
      projectModalVisible: false,
      projectModalType: '新建',
      version: '1.0.0',
      menus: [
        {
          label: '文件',
          children: [
            {
              name: '新建',
              cb: this.toCreate,
            },
            {
              name: '打开',
              cb: this.toOpen,
            },
            {
              name: '保存',
              cb: this.toSave,
            },
            {
              name: '另存为',
              cb: this.toSaveOther,
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
  computed: {
    ...mapState({
      project: (state) => state.Project.project,
      params: (state) => state.Project.params,
    }),
  },
  mounted() {
    //保存打开新建项目之后 都会给渲染进程发送最新的项目信息
    this.$electron.ipcRenderer.on(
      'projectInfo',
      (_e, res) => {
        const { code, data, msg } = res;
        if (code === 0) {
          console.log(data);
        } else {
          this.$message.error(msg);
        }
      },
      []
    );
  },
  methods: {
    // 新建项目之后 打开项目，参数都为默认值
    //打开项目之后，使用默认值进行操作
    //保存项目 把params都保存到config。json 更新manifest.json的version和modified
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
    toOpen() {
      this.$electron.ipcRenderer.invoke('open-project').then((res) => {
        const { code, data, msg } = res;
        if (code === 0) {
          this.$store.dispatch('saveProject', JSON.parse(JSON.stringify(data)));
          this.$store.dispatch(
            'saveParams',
            JSON.parse(JSON.stringify(data.configJson))
          );
        } else {
          this.$message.error(msg);
          this.$store.dispatch('saveProject', {});
        }
      });
    },
    toCreate() {
      this.projectModalType = '新建';
      this.projectModalVisible = true;
    },
    //另存
    toSaveOther() {
      this.projectModalType = '保存';
      this.projectModalVisible = true;
    },
    //保存
    toSave() {
      const project = Object.assign({}, this.project, {
        configJson: this.params,
      });
      this.$electron.ipcRenderer.invoke('save-project', project).then((res) => {
        const { code, data, msg } = res;
        if (code === 0) {
          this.$store.dispatch('saveProject', JSON.parse(JSON.stringify(data)));
          this.$store.dispatch(
            'saveParams',
            JSON.parse(JSON.stringify(data.configJson))
          );
          this.$message.success(`保存成功`);
        } else {
          this.$message.error(msg);
          this.$store.dispatch('saveProject', {});
        }
      });
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
    closeModal() {
      this.projectModalVisible = false;
    },
    saveHandle(data) {
      this.$electron.ipcRenderer
        .invoke(
          'create-project',
          Object.assign({}, data, { configJson: this.params })
        )
        .then((res) => {
          //创建成功之后，
          const { code, data, msg } = res;
          if (code === 0) {
            //新建之后直接打开项目
            if (this.projectModalType === '新建') {
              this.$store.dispatch(
                'saveProject',
                JSON.parse(JSON.stringify(data))
              );
            }
            this.$message.success(`${this.projectModalType}成功`);
          } else {
            this.$message.error(msg);
            this.$store.dispatch('saveProject', {});
          }
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
        left: 10px;
        top: 29px;
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
