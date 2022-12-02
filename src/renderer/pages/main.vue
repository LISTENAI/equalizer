<template>
  <div class="main-page">
    <div class="top-banner flex">
      <div class="left flex">
        <el-select v-model="com" placeholder="请选择" size="middle">
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
          <svg-icon v-if="connecting" icon-class="r_connecting" class="icon" />
          <svg-icon
            v-else
            :icon-class="connected ? 'r_connected' : 'r_disconnected'"
            class="icon"
          />

          {{ connected && !connecting ? '已' : '未' }}连接{{
            connecting ? '中' : ''
          }}
        </span>
      </div>
      <div class="right flex">
        <el-select v-model="rate" placeholder="请选择" size="middle">
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
      @reset="resetModalData"
      @save="saveHandle"
    />
    <EQModal
      v-if="eqVisible"
      :visible="eqVisible"
      :checkable="eqCheckable"
      :eqData="eqData"
      @close="closeModal"
      @reset="resetModalData"
      @save="saveHandle"
    />
    <DRCModal
      v-if="drcVisible"
      :visible="drcVisible"
      :checkable="drcCheckable"
      :drcData="drcData"
      @close="closeModal"
      @reset="resetModalData"
      @save="saveHandle"
    />
  </div>
</template>
<script>
import VoiceModal from '@/components/VoiceModal';
import EQModal from '@/components/EQModal';
import DRCModal from '@/components/DRCModal';

export default {
  name: 'main-page',
  components: { VoiceModal, EQModal, DRCModal },
  data() {
    return {
      coms: [
        {
          value: 'COM1',
          label: 'COM1',
        },
        {
          value: 'COM2',
          label: 'COM2',
        },
        {
          value: 'COM3',
          label: 'COM3',
        },
      ],
      rates: [
        {
          value: '48K',
          label: 'Music Manager 48K',
        },
      ],
      com: '',
      rate: '',
      connected: false,
      connecting: false,
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
      voiceType: {
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
        EQ: [
          { fc: 26, gain: 0, q: 0.5, type: 'Peaking' },
          { fc: 40, gain: 0, q: 0.7, type: 'LowPass' },
          { fc: 63, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 80, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 125, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 250, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 500, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 1000, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 2000, gain: 0, q: 0.7, type: 'Peaking' },
          { fc: 2500, gain: 0, q: 0.7, type: 'Peaking' },
        ],
        DRC: {
          data: [],
          startTime: 10,
          releaseTime: 500,
          drcType: 'Peak',
        },
      },
      eqType: {},
      currentModal: '',
      voiceVisible: false,
      voiceCheckable: false, // 低音/高音/输出 bypass
      vocieData: {}, // 低音/高音/输出 数据
      eqVisible: false,
      eqCheckable: false, // EQ bypass
      eqData: [], // EQ 数据
      drcVisible: false,
      drcCheckable: false, // drc bypass
      drcData: [], // drc 数据
    };
  },
  mounted() {},
  methods: {
    open(link) {
      this.$electron.shell.openExternal(link);
    },
    opreateHandle(item) {
      switch (item.type) {
        case 'EQ':
          this.openEQModal(item);
          break;
        case 'DRC':
          this.openDRCModal(item);
          break;
        default:
          this.openVoiceModal(item);
          break;
      }
    },
    openEQModal(item) {
      this.eqVisible = true;
      this.currentModal = item.type;
      this.eqData = JSON.parse(JSON.stringify(this.voiceType[item.type]));
      this.voiceCheckable = item.checkable;
    },
    openDRCModal(item) {
      this.drcVisible = true;
      this.currentModal = item.type;
      this.vocieData = JSON.parse(JSON.stringify(this.voiceType[item.type]));
    },
    openVoiceModal(item) {
      this.voiceVisible = true;
      this.currentModal = item.type;
      this.vocieData = JSON.parse(JSON.stringify(this.voiceType[item.type]));
      this.voiceCheckable = item.checkable;
    },
    resetModalData(type) {
      switch (type) {
        case 'voice':
          this.vocieData = JSON.parse(
            JSON.stringify(this.voiceType[this.currentModal])
          );
          break;
        case 'eq':
          this.eqData = JSON.parse(
            JSON.stringify(this.voiceType[this.currentModal])
          );
          break;
      }
    },
    closeModal() {
      this.voiceVisible = false;
      this.eqVisible = false;
      this.drcVisible = false;
    },
    saveHandle(type, data) {
      console.log(type, data);
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
        border-radius: 4px;
        padding: 3px 8px;
        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        span {
          font-size: 11px;
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
