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
    <div class="info flex">
      {{
        project?.manifestJson?.name ? project?.manifestJson?.name : '未命名 - 1'
      }}
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
    <el-dialog
      width="466px"
      class="confirm-dialog"
      :visible="confirmVisible"
      :show-close="false"
    >
      <p class="desc">
        是否保存对“
        {{
          project?.manifestJson?.name
            ? project?.manifestJson?.name
            : '未命名 - 1'
        }}”所做的更改？如果不保存，更改的内容将会丢失
      </p>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="closeHandle(true, true)"
          >保存</el-button
        >
        <el-button @click="() => closeHandle(false, true)">不保存</el-button>
        <el-button @click="() => closeHandle(false, false)">取 消</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import ProjectModal from './CreateProjectModal';
import { mapState } from 'vuex';
const LogoImg = require('@/assets/imgs/lsAudio.png');
import defaultConfig from '../utils/config';
export default {
  name: 'TopBar',
  components: { ProjectModal },
  data() {
    return {
      projectModalVisible: false,
      confirmVisible: false,
      isclose: false,
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
    window.addEventListener('keydown', this.handleEvent);
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
      if (this.params && Object.keys(this.params).length !== 0) {
        this.confirmVisible = true;
      } else {
        this.$electron.ipcRenderer.send('window-close');
      }
    },
    closeHandle(isSave, isClose) {
      this.isclose = isClose;
      if (!isSave && !isClose) {
        this.confirmVisible = false;
        return;
      }
      if (!isSave && isClose) {
        this.confirmVisible = false;
        this.$electron.ipcRenderer.send('window-close');
        return;
      }
      if (isSave) {
        this.toSave();
      }
    },
    menuCick(menu) {
      console.log(menu);
    },
    getInfoHtml() {
      return `
        <div class="info-content">
          <img src=${LogoImg} alt="" class="logo" />
          <p>聆思音频下行工具</p>
          <p>${this.version}</p>
        </div>
        `;
    },
    toOpen() {
      this.$electron.ipcRenderer.invoke('open-project').then((res) => {
        const { code, data, msg } = res;
        if (code === 0) {
          if (!data) return;
          this.$store.dispatch('changeReset', true);
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
      if (this.project && Object.keys(this.project).length === 0) {
        return this.toCreate();
      }
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
          this.confirmVisible = false;
          if (this.isclose) {
            this.$electron.ipcRenderer.send('window-close');
          }
        } else {
          if (msg === '项目不存在') {
            this.projectModalType === '保存';
            this.projectModalVisible = true;
          }
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
          Object.assign({}, data, {
            configJson:
              this.projectModalType === '新建' ? defaultConfig : this.params,
          })
        )
        .then((res) => {
          const { code, data, msg } = res;
          if (code === 0) {
            //新建之后直接打开项目
            if (this.projectModalType === '新建') {
              this.$store.dispatch(
                'saveProject',
                JSON.parse(JSON.stringify(data))
              );
              this.$store.dispatch('saveParams', defaultConfig);
            }
            this.$message.success(`${this.projectModalType}成功`);
            this.confirmVisible = false;
            if (this.isclose) {
              this.$electron.ipcRenderer.send('window-close');
            }
          } else {
            this.$message.error(msg);
            this.$store.dispatch('saveProject', {});
          }
        });
    },
    handleEvent(event) {
      switch (event.keyCode) {
        case 79:
          event.preventDefault();
          event.returnValue = false;
          if (event.ctrlKey && event.code === 'KeyO') {
            this.toOpen();
          }
          break;
        case 83:
          event.preventDefault();
          event.returnValue = false;
          if (event.ctrlKey && event.code === 'KeyS') {
            this.toSave();
          }
          break;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.confirm-dialog {
  .desc {
    width: 328px;
    font-size: 13px;
    color: #cccccc;
    line-height: 18px;
  }
}

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
  .info {
    height: 100%;
    flex: 1;
    justify-content: center;
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
