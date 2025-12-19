<template>
  <el-dialog
    :title="detail.title"
    v-model="show"
    width="600px"
    class="low-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="beforeCloseHandle"
  >
    <div class="container">
      <div class="item flex" v-for="(item, index) in detail.item" :key="index">
        <div class="left flex">
          <span>{{ item.desc }}</span>
          <el-input-number
            v-model="item.value"
            controls-position="right"
            :min="item.min"
            :max="item.max"
            size="small"
          ></el-input-number>
          <i>{{ item.unit }}</i>
        </div>
        <div class="right flex">
          <i>{{ item.min }}</i>
          <el-slider
            v-model="item.value"
            :min="item.min"
            :max="item.max"
            class="slider"
          ></el-slider>
          <i>{{ item.max }}{{ item.unit }}</i>
        </div>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <div class="fl flex">
          <el-button @click="resetHandle">重置</el-button>
          <el-checkbox v-model="enable">Bypass</el-checkbox>
        </div>
        <el-button type="primary" @click="saveHandle">确 定</el-button>
        <el-button @click="beforeCloseHandle">取 消</el-button>
      </span>
    </template>

  </el-dialog>
</template>

<script>
export default {
  props: {
    voiceData: {
      type: Object,
      default: () => {
        return {};
      },
    },
    visible: {
      type: Boolean,
      default: () => {
        return {};
      },
    },
    checkable: {
      type: Boolean,
      default: false,
    },
    save: {
      type: Function,
    },
    reset: {
      type: Function,
    },
    close: {
      type: Function,
    },
    enableVoice: {
      type: Function,
    },
  },

  data() {
    return {
      type: 'voice',
      show: this.visible,
      detail: {},
      enable: this.checkable,
    };
  },
  mounted() {
    console.log('mounted', this.voiceData);
    this.detail = JSON.parse(JSON.stringify(this.voiceData));
  },
  watch: {
    voiceData: {
      handler(newVal) {
        console.log('更新', this.voiceData.type, newVal);
        this.detail = JSON.parse(JSON.stringify(newVal));
        this.enable = this.checkable;
      },
      deep: true,
    },
    checkable: function (newVal) {
      this.enable = newVal;
    },
    visible: function (newVal) {
      this.show = newVal;
      this.enable = this.checkable;
      console.log(this.voiceData);
    },
  },
  methods: {
    saveHandle() {
      this.closeHandle();
      const params = { enable: !this.enable };
      if (this.detail.type === 'agc') {
        const { value } = this.detail?.item[0];
        params.vol = value;
      } else {
        this.detail.item &&
          this.detail.item.map((item) => {
            params[item.type] = parseInt(item.value);
          });
      }
      this.$emit('save', this.detail.type, params);
    },
    beforeCloseHandle() {
      this.$confirm('是否确定关闭?', '', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
        .then(() => {
          this.closeHandle();
        })
        .catch(() => {
          return;
        });
    },
    closeHandle() {
      this.$emit('close');
    },
    resetHandle() {
      this.enable = false;
      this.$emit('reset', this.detail.type);
    },
  },
};
</script>
<style lang="scss" scoped>
.low-dialog {
  .item {
    color: $font-color;
    justify-content: space-between;
    .left {
      width: 204px;
      justify-content: space-between;
    }
    .right {
      width: 300px;
      justify-content: space-between;
    }
    span {
      width: 104px;
      height: 18px;
      font-size: 13px;
      line-height: 18px;
      margin-right: 8px;
    }
    i {
      font-style: normal;
      //   width: 17px;
      height: 18px;
      font-size: 13px;
      color: #808080;
      line-height: 18px;
    }
    .slider {
      width: 195px;
    }
  }
  .dialog-footer {
    .el-button {
      padding: 7px 25.5px;
      margin-right: 0;
    }
    .fl {
      float: left;
      .el-button {
        padding: 7px 17px;
        margin-right: 16px;
      }
    }
  }
}
</style>
