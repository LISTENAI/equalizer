<template>
  <el-dialog
    :title="detail.title"
    :visible="show"
    width="600px"
    class="low-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="closeHandle"
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
            size="mini"
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

    <span slot="footer" class="dialog-footer">
      <div class="fl">
        <el-button @click="resetHandle">重置</el-button>
        <el-checkbox v-model="enable">Bypass</el-checkbox>
      </div>
      <el-button type="primary" @click="saveHandle">确 定</el-button>
      <el-button @click="closeHandle">取 消</el-button>
    </span>
  </el-dialog>
</template>

<script>
import _ from 'lodash';
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
  watch: {
    voiceData: {
      handler(newVal) {
        this.detail = newVal;
      },
      deep: true,
    },
    checkable: function (newVal) {
      this.enable = newVal;
    },
    visible: function (newVal) {
      this.show = newVal;
      this.enable = this.checkable;
    },
  },
  methods: {
    saveHandle() {
      this.closeHandle();
      const params = { enable: !this.enable };
      if (this.detail.type === 'agc') {
        const { sr, vol, item } = this.detail;
        // data = {
        //   enable: true,
        //   sr: 16000,
        //   vol: 24,
        //   mono_gains: [
        //     [true, 10],
        //     [true, 20],
        //   ],
        // };
        params.sr = sr;
        params.vol = vol;
        params.mono_gains = [];
        item &&
          item.map((item) => {
            params.mono_gains.push([true, parseInt(item.value)]);
          });
      } else {
        this.detail.item &&
          this.detail.item.map((item) => {
            params[item.type] = parseInt(item.value);
          });
      }
      this.$emit('save', this.detail.type, params);
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
      width: 220px;
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
