<template>
  <div class="main-page">
    <div class="top-banner flex">
      <div class="left flex">
        <el-select v-model="value" placeholder="请选择" size="middle">
          <el-option
            v-for="item in coms"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
        <el-button size="mini">连接</el-button>
        <span class="flex">
          <svg-icon
            :icon-class="connected ? 'r_connected' : 'r_disconnected'"
            class="icon"
          />
          {{ connected ? '已' : '未' }}连接</span
        >
      </div>
      <div class="right flex">
        <el-select v-model="value" placeholder="请选择" size="middle">
          <el-option
            v-for="item in rates"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
        <div class="opt-btn flex">
          <svg-icon icon-class="get" class="icon" />
          <span>获取参数</span>
        </div>
        <div class="opt-btn flex margin">
          <svg-icon icon-class="write" class="icon" />
          <span>写入参数</span>
        </div>
        <div class="opt-btn flex">
          <svg-icon icon-class="export" class="icon" />
          <span>导出bin文件</span>
        </div>
      </div>
    </div>
    <div class="container flex">
      <div class="progress flex">
        <div class="step text">输入</div>
        <div class="step flex" v-for="item in options" :key="item.text">
          <img v-bind:src="arrowImgUrl" class="arrow" />
          <div class="flex box">
            <img v-bind:src="item.imageUrl" />
            <p class="text">{{ item.text }}</p>
            <el-button
              @click="() => opreateHandle(item)"
              :disabled="item.checkable"
              >设置</el-button
            >
            <el-checkbox v-model="item.checkable">Bypass</el-checkbox>
          </div>
        </div>
        <div class="step flex arrow-part">
          <div class="flex">
            <img v-bind:src="arrowImgUrl" class="arrow" />
            <span class="single-text">L</span>
            <img v-bind:src="soundImgUrl" class="sound-img" />
          </div>
          <div class="text">输出</div>
          <div class="flex">
            <img v-bind:src="arrowImgUrl" class="arrow" />
            <span class="single-text">R</span>
            <img v-bind:src="soundImgUrl" class="sound-img" />
          </div>
        </div>
      </div>
    </div>
    <VoiceModal
      :visible="voiceVisible"
      :checkable="voiceCheckable"
      :vocieData="vocieData"
      @close="closeModal"
      @reset="resetVoiceModal"
      @save="saveHandle"
    />
  </div>
</template>
<script>
import VoiceModal from '@/components/VoiceModal';
const voiceType = {
  low: {
    title: '低音增强',
    item: [
      {
        type: 'gain',
        value: 0,
        max: 24,
        min: 0,
        desc: '低音增强增益',
        unit: 'dB',
      },
      {
        type: 'rate',
        value: 0,
        max: 200,
        min: 0,
        desc: '低音增强截止频率',
        unit: 'Hz',
      },
    ],
  },
  high: {
    title: '高音增强',
    item: [
      {
        type: 'gain',
        value: 0,
        max: 15,
        min: 0,
        desc: '高音增强增益',
        unit: 'dB',
      },
      {
        type: 'rate',
        value: 0,
        max: 2000,
        min: 0,
        desc: '高音增强截止频率',
        unit: 'Hz',
      },
    ],
  },
  out: {
    title: '输出',
    item: [
      {
        type: 'leftGain',
        value: 0,
        max: 20,
        min: -100,
        desc: '左声道增益',
        unit: 'dB',
      },
      {
        type: 'rightGain',
        value: 0,
        max: 20,
        min: -100,
        desc: '右声道增益',
        unit: 'dB',
      },
    ],
  },
};
export default {
  name: 'main-page',
  components: { VoiceModal },
  data() {
    return {
      coms: [
        {
          value: '选项1',
          label: '黄金糕',
        },
        {
          value: '选项2',
          label: '双皮奶',
        },
        {
          value: '选项3',
          label: '蚵仔煎',
        },
        {
          value: '选项4',
          label: '龙须面',
        },
        {
          value: '选项5',
          label: '北京烤鸭',
        },
      ],
      rates: [
        {
          value: '选项1',
          label: '黄金糕',
        },
      ],
      value: '',
      connected: true,
      arrowImgUrl: 'static/imgs/arrow.png',
      soundImgUrl: 'static/imgs/output.png',
      options: [
        {
          type: 'low',
          text: '低音增强',
          imageUrl: 'static/imgs/low.png',
          checkable: false,
        },
        {
          type: 'high',
          text: '高音增强',
          imageUrl: 'static/imgs/high.png',
          checkable: false,
        },
        {
          type: 'EQ',
          text: 'EQ均衡器',
          imageUrl: 'static/imgs/eq.png',
          checkable: false,
        },
        {
          type: 'DRC',
          text: 'DRC',
          imageUrl: 'static/imgs/drc.png',
          checkable: false,
        },
        {
          type: 'out',
          text: '输出增益',
          imageUrl: 'static/imgs/out.png',
          checkable: false,
        },
      ],
      currentModal: '',
      voiceVisible: false,
      voiceCheckable: false,
      vocieData: {},
      originData: voiceType[this.currentModal],
    };
  },
  methods: {
    open(link) {
      this.$electron.shell.openExternal(link);
    },
    opreateHandle(item) {
      console.log(item.type, voiceType[item.type]);
      this.voiceVisible = true;
      this.currentModal = item.type;
      this.vocieData = JSON.parse(JSON.stringify(voiceType[item.type]));
      this.voiceCheckable = item.checkable;
    },
    resetVoiceModal() {
      console.log(voiceType);
      this.vocieData = JSON.parse(JSON.stringify(voiceType[this.currentModal]));
    },
    closeModal() {
      this.voiceVisible = false;
    },
    saveHandle(data) {
      console.log(data);
    },
  },
};
</script>
<style lang="scss" scoped>
.main-page {
  background-color: $background;
  min-height: 100%;
  color: $font-color;
  .icon {
    display: block;
    width: 16px;
    height: 16px;
    background-size: cover;
    margin: 0 2px;
  }
  .top-banner {
    justify-content: space-between;
    width: 100%;
    height: 56px;
    background: $grey1;
    box-sizing: border-box;
    padding: 0 16px;
    .connect {
      background-image: url('@~/asstes/imgs/r_connected.svg');
    }
    .disconnect {
      background-image: url('@~/asstes/imgs/r_disconnected.svg');
    }
    .el-button {
      height: 28px;
      margin: 0 8px;
    }

    .left {
      .el-select {
        width: 160px;
      }
    }
    .right {
      .el-select {
        width: 200px;
        margin-right: 32px;
      }
      .opt-btn {
        flex-direction: column;
        cursor: pointer;
        &:hover {
          opacity: 0.7;
        }
        &.margin {
          margin: 0 24px;
        }
        .icon {
          margin-bottom: 2px;
        }
      }
    }
  }
  .container {
    width: 100%;
    height: calc(100vh - 56px);
    text-align: center;
    justify-content: center;
    align-items: center;
    font-family: MicrosoftYaHei;
    .progress {
      width: auto;
      height: 282px;
      margin: 0 auto;
      .step {
        &.text {
          width: 15px;
          height: 44px;
          font-size: 15px;
          color: $font-color;
          line-height: 22px;
          margin-right: 8px;
        }
        .box {
          flex-direction: column;
          background-color: $grey1;
          padding: 48px 16px;
          border-radius: 12px;
          img {
            width: 64px;
            height: 64px;
          }
          .text {
            height: 22px;
            font-size: 15px;
            color: $font-color;
            line-height: 22px;
            margin-top: 6px;
          }
          .el-button {
            width: 112px;
            margin: 24px 0;
          }
        }
        .arrow {
          width: 40px;
          height: 24px;
        }
      }
      .arrow-part {
        flex-direction: column;
        height: 282px;
        justify-content: space-around;
        .sound-img {
          width: 64px;
          height: 64px;
        }
        .single-text {
          margin: 0 12px;
          font-size: 15px;
        }
        .text {
          width: 15px;
          height: 44px;
          font-size: 15px;
          color: $font-color;
          line-height: 22px;
          margin-right: 15px;
        }
      }
    }
  }
}
</style>
