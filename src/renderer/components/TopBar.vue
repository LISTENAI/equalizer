<template>
  <div class="top-bar flex">
    <img class="logo" :src="logoUrl" />
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
        <svg-icon :icon-class="isMax ? 'win_resize' : 'win_max'"></svg-icon>
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
      v-model="confirmVisible"
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
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="closeHandle(true, true)"
            >保存</el-button
          >
          <el-button @click="() => closeHandle(false, true)">不保存</el-button>
          <el-button @click="() => closeHandle(false, false)">取 消</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import ProjectModal from './CreateProjectModal.vue';
import { mapState } from 'vuex';
import defaultConfig from '../utils/config';
import logoImg from '../assets/imgs/lsAudio.png';
import _ from 'lodash';
export default {
  name: 'TopBar',
  components: { ProjectModal },
  data() {
    return {
      projectModalVisible: false,
      originParams: {},
      confirmVisible: false,
      isCose: false,
      projectModalType: '新建',
      version: '1.0.0',
      menus: [
        {
          label: '文件',
          children: [
            {
              name: '新建',
              cb: this.toCreateHandle,
            },
            {
              name: '打开',
              cb: this.toOpenHandle,
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
      isCreate: false,
      isOpen: false,
      creating: false,
      opening: false,
      logoUrl: logoImg,
    };
  },
  created() {
    this.version = window.appInfo.version;
  },
  computed: {
    ...mapState({
      project: (state) => state.Project.project,
      params: (state) => state.Project.params,
      rate: (state) => state.Project.rate,
      connect: (state) => state.Project.connect,
    }),
  },
  mounted() {
    this.originParams = _.cloneDeep(this.params);
    window.addEventListener('keydown', this.handleEvent);
    //保存打开新建项目之后 都会给渲染进程发送最新的项目信息
    window.ipcRenderer.on(
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
    window.ipcRenderer.on(
      'windowChange',
      (_e, res) => {
        const { isMaximized } = res;
        this.isMax = isMaximized;
      },
    )
  },
  methods: {
    // 新建项目之后 打开项目，参数都为默认值
    //打开项目之后，使用默认值进行操作
    //保存项目 把params都保存到config。json 更新manifest.json的version和modified
    max() {
      this.isMax = !this.isMax;
      window.ipcRenderer.send('window-max');
    },
    min() {
      this.isMax = false;
      window.ipcRenderer.send('window-min');
    },
    close() {
      this.confirmVisibleType = 'close';
      if (this.params && Object.keys(this.params).length !== 0) {
        this.confirmVisible = true;
      } else {
        window.ipcRenderer.send('window-close');
      }
    },
    async closeHandle(isSave, isClose) {
      //新建弹窗和打开项目不需要关闭工具
      const isCloseWin = this.confirmVisibleType === 'close';
      const isCreate = this.confirmVisibleType === 'new';
      const isOpen = this.confirmVisibleType === 'open';
      this.isCose = isCloseWin ? isClose : false;
      this.isCreate = isCreate;
      this.isOpen = isOpen;
      this.confirmVisible = false;
      console.log(
        'isSave',
        isSave,
        'isCreate',
        isCreate,
        'isOpen',
        isOpen,
        'isCloseWin',
        isCloseWin
      );
      if (isSave) {
        await this.toSave();
        if (isCreate) {
          const timeid = setInterval(() => {
            if (!this.creating && this.isCreate) {
              this.toCreate();
              clearInterval(timeid);
            }
          }, 600);
        }
        if (isOpen) {
          const timeid = setInterval(async () => {
            if (!this.creating && !this.opening && this.isOpen) {
              await this.toOpen();
              clearInterval(timeid);
            }
          }, 600);
        }
        // isOpen && this.toOpen();
        // isCloseWin && window.ipcRenderer.send('window-close');
        return;
      }
      if (!isSave && isClose) {
        isCreate && this.toCreate();
        if (isOpen) {
          const timeid = setInterval(async () => {
            if (!this.creating && !this.opening) {
              await this.toOpen();
              clearInterval(timeid);
            }
          }, 600);
        }
        // isOpen && this.toOpen();
        isCloseWin && window.ipcRenderer.send('window-close');
        return;
      }
      if (!isClose) {
        this.creating = false;
        this.opening = false;
        return;
      }
    },
    menuCick(menu) {
      console.log(menu);
    },
    getInfoHtml() {
      return `
        <div class="info-content">
          <img src=${this.logoUrl} alt="" class="logo" />
          <p>LSAudio</p>
          <p>${this.version}</p>
        </div>
        `;
    },
    async toOpenHandle() {
      if (
        this.params &&
        JSON.stringify(this.params) !== JSON.stringify(this.originParams)
      ) {
        this.confirmVisibleType = 'open';
        this.confirmVisible = true;
      } else {
        await this.toOpen();
      }
    },
    async toOpen() {
      this.opening = true;
      const res = await window.ipcRenderer.invoke('open-project');
      const { code, data, msg } = res;
      this.opening = false;
      if (code === 0) {
        if (!data) return;
        //已连接固件状态，打开不一致的采样率项目
        const fs =
          data?.configJson?.drc?.fs ||
          data?.configJson?.bass_boost?.fs ||
          data?.configJson?.treble_boost?.fs;
        if (this.connect) {
          if (parseInt(fs) !== parseInt(this.rate)) {
            this.$confirm(
              '该项目和已连接的固件采样率不一致，请打开和固件采样率相同的项目',
              '',
              {
                showCancelButton: false,
                showClose: false,
                closeOnClickModal: false,
                confirmButtonText: '确定',
                type: 'warning',
              }
            ).then(async () => {
              return;
            });
            return;
          }
        }
        this.$store.dispatch('changeReset', true);
        this.$store.dispatch('saveProject', _.cloneDeep(data));
        this.$store.dispatch('saveParams', _.cloneDeep(data.configJson));
        this.originParams = _.cloneDeep(data.configJson);
        this.$store.dispatch('changeFsReset', false);
        this.$store.dispatch('changeRate', (fs && parseInt(fs)) || 48000);
      } else {
        this.$message.error(msg);
        this.$store.dispatch('saveProject', {});
      }
      this.opening = false;
    },
    toCreate() {
      this.creating = true;
      this.projectModalType = '新建';
      this.projectModalVisible = true;
    },
    toCreateHandle() {
      if (
        this.params &&
        JSON.stringify(this.params) !== JSON.stringify(this.originParams)
      ) {
        this.confirmVisibleType = 'new';
        this.confirmVisible = true;
      } else {
        this.toCreate();
      }
    },
    //另存
    toSaveOther() {
      this.projectModalType = '保存';
      this.projectModalVisible = true;
    },

    //保存
    //新建 默认参数
    //保存 -》现有参数
    async toSave() {
      //保存的时候给没有设置的模块默认参数
      const finalParams = this.mergeParams();
      if (this.project && Object.keys(this.project).length === 0) {
        this.isSave = true;
        return this.toCreate();
      }
      const project = Object.assign({}, this.project, {
        configJson: finalParams,
      });
      const res = await window.ipcRenderer.invoke(
        'save-project',
        project
      );
      const { code, data, msg } = res;
      this.creating = false;
      if (code === 0) {
        this.$message.success(`保存成功`);
        this.confirmVisible = false;
        this.$store.dispatch('saveProject', _.cloneDeep(data));
        // console.log('更新params2', data.configJson);
        this.$store.dispatch('saveParams', _.cloneDeep(data.configJson));
        this.originParams = _.cloneDeep(data.configJson);
        if (this.isCose) {
          window.ipcRenderer.send('window-close');
        }
      } else {
        if (msg === '项目不存在') {
          this.projectModalType = '保存';
          this.projectModalVisible = true;
        }
        this.$message.error(msg);
        this.$store.dispatch('saveProject', {});
      }
      this.creating = false;
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
      this.opening = false;
      this.creating = false;
      this.isSave = false;
    },
    //新建|另存
    saveHandle(data) {
      const defaultParams = defaultConfig(this.rate);
      const finalParams = this.mergeParams();
      //未打开项目点击保存走新建逻辑，但需要保存现编辑的参数
      //未打开项目点击新建，直接保存默认参数
      let saveParamsObj = defaultParams;
      if (this.isSave) {
        if (Object.keys(this.params).length === 0) {
          saveParamsObj = defaultParams;
        } else {
          saveParamsObj =
            Object.keys(this.project).length === 0
              ? finalParams
              : defaultParams;
        }
      }
      const params = Object.assign({}, data, {
        configJson:
          this.projectModalType === '新建' ? saveParamsObj : finalParams,
      });
      console.log('saveHandle', this.isSave, this.projectModalType, params);
      window.ipcRenderer
        .invoke('create-project', params)
        .then((res) => {
          const { code, data, msg } = res;
          this.creating = false;
          if (code === 0) {
            this.$message.success(`${this.projectModalType}成功`);
            this.$store.dispatch('saveProject', _.cloneDeep(data));
            // console.log('更新params1', data.configJson);
            this.$store.dispatch('saveParams', _.cloneDeep(data.configJson));
            this.originParams = _.cloneDeep(data.configJson);
            this.confirmVisible = false;
            if (this.isCose) {
              window.ipcRenderer.send('window-close');
            }
          } else if (code === -1) {
            this.$message.error(msg);
            this.$store.dispatch('saveProject', {});
          } else {
            //-2 保存项目名字冲突取消保存
            return;
          }
        });
    },
    handleEvent(event) {
      switch (event.keyCode) {
        case 79:
          if (event.ctrlKey && event.code === 'KeyO') {
            this.toOpenHandle();
          }
          break;
        case 83:
          if (event.ctrlKey && event.code === 'KeyS') {
            this.toSave();
          }
          break;
      }
    },
    mergeParams() {
      //drc.dots不能进行merge ,不同段数dots长度不同
      const dotsArr = this.params?.drc?.dots;
      const defaultParams = defaultConfig(this.rate);
      let finalParams = _.merge(_.cloneDeep(defaultParams), this.params);
      finalParams.drc.dots = dotsArr?.length ? dotsArr : finalParams.drc.dots;
      return finalParams;
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
