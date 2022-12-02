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
        <el-checkbox v-model="checkable">Bypass</el-checkbox>
      </div>
      <el-button type="primary" @click="saveHandle">确 定</el-button>
      <el-button @click="closeHandle">取 消</el-button>
    </span>
  </el-dialog>
</template>

<script>
export default {
  props: {
    vocieData: {
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
      default: () => {
        return {};
      },
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
  },

  data() {
    return {
      type: 'voice',
      show: this.visible,
      detail: {},
    };
  },
  watch: {
    vocieData: {
      handler(newVal) {
        this.detail = newVal;
      },
      deep: true,
    },
    visible: function (newVal) {
      this.show = newVal;
    },
  },

  methods: {
    saveHandle() {
      this.closeHandle();
      const params = { checkable: this.checkable };
      this.detail.item &&
        this.detail.item.map((item) => {
          params[item.type] = item.value;
        });
      this.$emit('save', this.type, params);
    },
    closeHandle() {
      this.resetHandle();
      this.$emit('close');
    },
    resetHandle() {
      this.$emit('reset', this.type);
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
