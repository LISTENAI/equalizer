<!-- 获取参数之前没办法设置写入参数，因为有些字段是通过串口拿到的，页面并没有-->
<!-- 缺少工具logo icon-->
<!-- 验证打包其他版本 serialport10.x只支持win10,window上暂时不能打liunx安装包-->
<template>
  <div class="main-page">
    <div class="top-banner flex">
      <div class="left flex">
        <el-select
          v-model="com"
          placeholder="请选择"
          size="middle"
          v-loading="comsLoading"
          @visible-change="getComs"
        >
          <el-option
            v-for="item in coms"
            :key="item.path"
            :label="item.path"
            :value="item.path"
          >
          </el-option>
        </el-select>
        <el-button
          size="mini"
          @click="connectHandle"
          :disabled="connecting || !com"
          v-loading="connecting"
        >
          {{ connected && !connecting ? '断开' : '连接' }}</el-button
        >
        <span class="flex">
          <svg-icon v-if="connecting" icon-class="r_connecting" class="icon" />
          <svg-icon
            v-else
            :icon-class="connected ? 'r_connected' : 'r_disconnected'"
            class="icon"
          />
          <span v-if="!connecting"> {{ connected ? '已' : '未' }}连接</span>
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
        <div
          class="opt-btn flex"
          :class="!connected || loading || writing ? 'disabled' : ''"
          @click="getAllParams"
        >
          <svg-icon icon-class="get" class="icon" />
          <span>获取参数</span>
        </div>
        <div
          class="opt-btn flex margin"
          v-loading="writing"
          :class="!connected || loading || writing ? 'disabled' : ''"
          @click="saveAllParamsHandle"
        >
          <svg-icon icon-class="write" class="icon" />
          <span>写入参数</span>
        </div>
        <div
          class="opt-btn flex"
          :class="connected ? '' : 'disabled'"
          @click="clearTime"
        >
          <svg-icon icon-class="export" class="icon" />
          <span>导出bin文件</span>
        </div>
      </div>
    </div>
    <div class="container flex" v-loading="loading">
      <div class="progress flex">
        <div class="step text">输入</div>
        <div class="step flex" v-for="item in options" :key="item.text">
          <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
          <div class="flex box">
            <img :src="require('@/assets/imgs/' + item.imageUrl)" />
            <p class="text">{{ item.text }}</p>
            <el-button
              :disabled="item.enable || !connected"
              @click="() => opreateHandle(item)"
              >设置</el-button
            >
            <el-checkbox v-model="item.enable" :disabled="!connected"
              >Bypass</el-checkbox
            >
          </div>
        </div>
        <div class="step flex arrow-part">
          <div class="flex">
            <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
            <span class="single-text">L</span>
            <img
              :src="require('@/assets/imgs/' + soundImgUrl)"
              class="sound-img"
            />
          </div>
          <div class="text">输出</div>
          <div class="flex">
            <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
            <span class="single-text">R</span>
            <img
              :src="require('@/assets/imgs/' + soundImgUrl)"
              class="sound-img"
            />
          </div>
        </div>
      </div>
    </div>

    <VoiceModal
      v-if="voiceVisible"
      :visible="voiceVisible"
      :checkable="voiceCheckable"
      :voiceData="voiceData[currentModalType]"
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
import VoiceModal from 'components/VoiceModal.vue';
import EQModal from 'components/EqModal.vue';
import DRCModal from 'components/DRCModal.vue';
import SerialPortHandle from '../utils/serialport';
import { checkConnect, setParams, getParams, TYPES } from '../utils/index';

export default {
  name: 'main-page',
  components: { VoiceModal, EQModal, DRCModal },
  data() {
    return {
      // dataTypes: ['bass_boost', 'treble_boost', 'drc', 'eq', 'agc'],
      coms: [],
      rates: [
        {
          value: '4800',
          label: 'Music Manager 48K',
        },
      ],
      com: '',
      rate: '4800',
      comsLoading: false,
      loading: false,
      writing: false,
      connected: false,
      connecting: false,
      arrowImgUrl: 'arrow.png',
      soundImgUrl: 'output.png',
      options: [
        {
          type: 'bass_boost',
          text: '低音增强',
          imageUrl: 'low.png',
          enable: false,
        },
        {
          type: 'treble_boost',
          text: '高音增强',
          imageUrl: 'high.png',
          enable: false,
        },
        {
          type: 'eq',
          text: 'EQ均衡器',
          imageUrl: 'eq.png',
          enable: false,
        },
        {
          type: 'drc',
          text: 'DRC',
          imageUrl: 'drc.png',
          enable: false,
        },
        {
          type: 'agc',
          text: '输出增益',
          imageUrl: 'out.png',
          enable: false,
        },
      ],
      voiceType: {
        bass_boost: {
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
              type: 'freq',
              value: 200,
              max: 200,
              min: 40,
              desc: '低音增强截止频率',
              unit: 'Hz',
            },
          ],
        },
        treble_boost: {
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
              type: 'freq',
              value: 2000,
              max: 2000,
              min: 200,
              desc: '高音增强截止频率',
              unit: 'Hz',
            },
          ],
        },
        agc: {
          title: '输出',
          item: [
            {
              type: 'leftGain',
              value: 0,
              max: 15,
              min: 0,
              desc: '左声道增益',
              unit: 'dB',
            },
            {
              type: 'rightGain',
              value: 0,
              max: 15,
              min: 0,
              desc: '右声道增益',
              unit: 'dB',
            },
          ],
        },
        eq: [
          { fc: 26, gain: 0, q: 0.5, type: 2 },
          { fc: 40, gain: 0, q: 0.7, type: 0 },
          { fc: 63, gain: 0, q: 0.7, type: 2 },
          { fc: 80, gain: 0, q: 0.7, type: 2 },
          { fc: 125, gain: 0, q: 0.7, type: 2 },
          { fc: 250, gain: 0, q: 0.7, type: 2 },
          { fc: 500, gain: 0, q: 0.7, type: 2 },
          { fc: 1000, gain: 0, q: 0.7, type: 2 },
          { fc: 2000, gain: 0, q: 0.7, type: 2 },
          { fc: 2500, gain: 0, q: 0.7, type: 2 },
        ],
        drc: {
          fs: 48000,
          seg: 5,
          at: 10,
          rt: 500,
          rms: 0.02,
          mode: 0,
          dots: [],
        },
      },
      originOptions: [],
      originVoiceType: [],
      eqType: {},
      currentModalType: '',
      voiceVisible: false,
      voiceCheckable: false, // 低音/高音/输出 bypass
      voiceData: {}, // 低音/高音/输出 数据
      eqVisible: false,
      eqCheckable: false, // EQ bypass
      eqData: [], // EQ 数据
      drcVisible: false,
      drcCheckable: false, // drc bypass
      drcData: null, // drc 数据
      allParams: {},
      eName: '',
      eDone: false,
    };
  },
  mounted() {
    this.originOptions = JSON.parse(JSON.stringify(this.options));
    this.originVoiceType = JSON.parse(JSON.stringify(this.voiceType));
    this.getComs();
    this.serialPorEmitterHandle();
    this.setInitData();
  },
  unmounted() {
    clearInterval(this.timeId);
  },
  watch: {
    connected(val) {
      if (val) {
        // this.getData();
      }
    },
  },
  methods: {
    //没有获取参数之前赋默认值
    setInitData() {
      TYPES.forEach((item) => {
        this.resetModalData(item);
      });
    },

    serialPorEmitterHandle() {
      SerialPortHandle.serialPorEmitter.on('SerialPort', (res) => {
        // console.log('data from SerialPort', res);
        // console.log(JSON.stringify(res));
        const { code, data } = res;
        if (this.eName === data.type) {
          this.eDone = true;
        }
        this.parseData(data.type, data.data, code, data.message);
      });
    },
    async getAllParams() {
      const dataTypes = JSON.parse(JSON.stringify(TYPES));
      if (!this.connected || this.loading || this.writing) return;
      this.loading = true;
      let timeId = setInterval(async () => {
        if (dataTypes.length === 0) {
          clearInterval(this.timeId);
          this.timeId = null;
          this.loading = false;
          this.eName = '';
          this.eDone = false;
          console.log('所有参数');
          console.log(this.voiceData);
          return;
        } else {
          const type = dataTypes[0];
          if (this.eName && this.eName === type) {
            if (this.eDone) {
              console.log(type, this.eName, this.eDone);
              dataTypes.shift();
              this.eName = '';
              this.eDone = false;
            }
          } else {
            this.eName = type;
            this.eDone = false;
            await this.getData(type);
          }
        }
      }, 400);
      this.timeId = timeId;
    },
    async getData(type) {
      if (!this.connected) {
        return;
      }
      try {
        console.log('getData-->', type);
        const params = getParams(type);
        await this.writeSerialPortHandle(params);
      } catch (error) {
        console.error(error);
      }
      //依次获取5
      // ['bass_boost'].map(async (type) => {
      //   try {
      //     const params = getParams(type);
      //     await this.writeSerialPortHandle(params);
      //   } catch (error) {
      //     console.error(error);
      //   }
      // });
    },

    async writeSerialPortHandle(params, errorCb) {
      try {
        await SerialPortHandle.write(params);
      } catch (error) {
        errorCb && errorCb();
        this.$message.error(error.message || '写入参数失败请重试');
      }
    },
    async getComs() {
      this.comsLoading = true;
      const res = await SerialPortHandle.getList();
      this.coms = res;
      this.comsLoading = false;
      console.log(res);
    },
    open(link) {
      this.$electron.shell.openExternal(link);
    },
    async connectHandle() {
      try {
        if (this.connected) {
          await SerialPortHandle.close();
          this.connected = false;
        } else {
          this.connecting = true;
          await SerialPortHandle.open(this.com);
          this.checkConnectHandle();
        }
      } catch (error) {
        this.connecting = false;
        this.connected = false;
        this.$message.error(error);
      }
    },
    async checkConnectHandle() {
      try {
        const params = checkConnect();
        SerialPortHandle.type = 'connect';
        await this.writeSerialPortHandle(params);
      } catch (error) {
        this.changeConnectHandle(false);
      }
    },
    async changeConnectHandle(isOk) {
      // console.log('isok', isOk);
      this.connected = isOk;
      this.connecting = false;
    },
    async opreateHandle(item) {
      switch (item.type) {
        case 'eq':
          await this.openEQModal(item);
          break;
        case 'drc':
          await this.openDRCModal(item);
          break;
        default:
          await this.openVoiceModal(item);
          break;
      }
    },
    //打开设置 ->获取参数
    async openEQModal(item) {
      // await this.getData(item.type);
      this.eqVisible = true;
      this.currentModalType = item.type;
      this.eqCheckable = item.enable;
      console.log(this.eqData);
    },
    async openDRCModal(item) {
      // await this.getData(item.type);
      this.currentModalType = item.type;
      this.drcCheckable = item.enable;
      this.drcVisible = true;
      console.log(this.drcData);
      // this.drcData = JSON.parse(JSON.stringify(this.voiceType['drc']));
    },
    async openVoiceModal(item) {
      console.log(this.voiceData);
      // await this.getData(item.type);
      this.voiceVisible = true;
      this.currentModalType = item.type;
      this.voiceCheckable = item.enable;
    },
    parseData(type, data, code, message) {
      switch (type) {
        case 'connect':
          this.changeConnectHandle(code === 0);
          break;
        case 'save':
          if (code === 0) {
            //设置数据成功 更新voiceType
            console.log('save成功');
          }
          break;
        case 'error':
          this.$message.error(message);
        case 'bass_boost':
          this.parseVoiceData('bass_boost', data);
          break;
        case 'treble_boost':
          this.parseVoiceData('treble_boost', data);
          break;
        case 'eq':
          this.parseEQData(data);
          break;
        case 'drc':
          this.parseDRCData(data);
          break;
        case 'agc':
          this.parseAGCData(data);
          break;
        default:
          break;
      }
    },
    parseEQData(data) {
      let modalData = JSON.parse(JSON.stringify(this.voiceType['eq']));
      if (data) {
        const { filters } = data;
        // filters.map((item) => {
        //   return {
        //     enable: !!item[0],
        //     dSampleRateHz:item[],
        //     dSampleRateHz:item[],
        //     dSampleRateHz:item[],

        //   };
        // });
        modalData = filters;
        // this.eqCheckable = !enable;
      }
      console.log('eqdata--->', modalData);
      this.eqData = modalData;
    },
    parseDRCData(data) {
      // data = {
      //   enable: true,
      //   fs: 16000,
      //   at: 10, //启动时间
      //   rt: 50, //释放时间
      //   mode: 0, //类型
      //   rms: 1, //Rms检测窗时间
      //   seg: 3, //DRC段数
      //   dots: [
      //     [1, 1, 1],
      //     [2, 2, 2],
      //     [3, 3, 3],
      //     [4, 4, 4],
      //   ],
      // };

      let modalData = JSON.parse(JSON.stringify(this.voiceType['drc']));
      if (data) {
        const { fs, at, rt, rms, mode, seg, dots } = data;
        modalData = {
          fs,
          at,
          rt,
          rms,
          mode,
          seg,
          dots: dots.map((item) => {
            return { x: item[0], y: item[1], w: item[2] };
          }),
        };
        // this.eqCheckable = !enable;
      }
      console.log(modalData);
      this.drcData = modalData;
    },
    parseAGCData(data) {
      // {
      //       type: 'leftGain',
      //       value: 0,
      //       max: 20,
      //       min: -100,
      //       desc: '左声道增益',
      //       unit: 'dB',
      //     }
      // data = {
      //   enable: true,
      //   sr: 16000,
      //   vol: 24,
      //   mono_gains: [
      //     [true, 10],
      //     [true, 20],
      //   ],
      // };
      let modalData = this.voiceType['agc'];
      modalData.type = 'agc';
      if (data) {
        const { mono_gains, sr, vol } = data;
        modalData.sr = sr;
        modalData.vol = vol;
        const item = mono_gains.map((item, index) => {
          return {
            type: `${index === 0 ? 'left' : 'right'}Gain`,
            value: item[1],
            max: 20,
            min: -100,
            desc: `${index === 0 ? '左' : '右'}声道增益`,
            unit: 'dB',
          };
        });
        modalData.item = item;
      }
      this.voiceData['agc'] = modalData;
    },
    parseVoiceData(type, data) {
      console.log(type, data);
      if (data) {
        const { gain, freq } = data;
        const modalData = this.voiceType[type];
        modalData.type = type;
        modalData.item.map((voice) => {
          switch (voice.type) {
            case 'gain':
              voice.value = parseInt(gain);
              break;
            case 'freq':
              voice.value = parseInt(freq);
              break;
          }
          return voice;
        });
        this.voiceData[type] = modalData;

        // this.voiceCheckable = !enable;
      } else {
        const modalData = JSON.parse(JSON.stringify(this.voiceType[type]));
        modalData.type = type;
        this.voiceData[type] = modalData;
      }
    },
    resetModalData(type) {
      const voiceData = JSON.parse(JSON.stringify(this.originVoiceType[type]));
      console.log('reset', type, voiceData);

      switch (type) {
        // case 'bass_boost':
        //   this.voiceData = voiceData;
        //   this.voiceCheckable = false;
        //   this.enableVoice(type, false);
        //   voiceData.type = type;
        //   break;
        // case 'treble_boost':
        //   this.voiceData = voiceData;
        //   this.voiceCheckable = false;
        //   this.enableVoice(type, false);
        //   voiceData.type = type;
        //   break;
        case 'eq':
          this.eqData = voiceData;
          this.eqCheckable = false;
          break;
        case 'drc':
          this.drcData = voiceData;
          this.drcCheckable = false;
          break;
        default: //'bass_boost'|'treble_boost'|'agc'
          voiceData.type = type;
          this.voiceData[type] = voiceData;
          this.voiceCheckable = false;
          this.enableVoice(type, false);
          break;
      }
    },
    closeModal() {
      this.voiceVisible = false;
      this.eqVisible = false;
      this.drcVisible = false;
    },
    //修改主页Bypass
    enableVoice(type, val) {
      let index;
      let voiceItem;
      this.originOptions.map((item, id) => {
        if (item.type === type) {
          index = id;
          voiceItem = JSON.parse(JSON.stringify(item));
        }
      });
      if (voiceItem) {
        voiceItem.enable = val;
        this.$set(this.options, index, voiceItem);
      }
    },
    async saveHandle(type, data) {
      this.parseData(type, data);
      if (type === 'eq') {
        const { filters } = data;
        data.filters = filters.map((item) => {
          const { enable, type, dSampleRateHz, q, gain, fc } = item;
          return [enable ? 1 : 0, type, dSampleRateHz || 48000, q, gain, fc];
        });
      }
      this.$set(this.allParams, type, data);
      this.enableVoice(type, !data.enable);
    },
    clearTime() {
      this.timeId && clearInterval(this.timeId);
      this.timeId = undefined;
    },
    //单个写入设置
    async saveParamsHandle(type, data) {
      try {
        console.log('写入参数', type, data);
        const params = setParams(type, data);
        SerialPortHandle.type = `save-${type}`;

        await this.writeSerialPortHandle(params, () => {
          this.resetModalData(type);
        });
      } catch (error) {
        this.$message.error(error.message);
      }
    },
    //写入所有参数
    async saveAllParamsHandle() {
      const saveDatas = Object.keys(this.allParams);
      if (!this.connected || this.loading || this.writing) return;
      console.log('写入参数');
      this.writing = true;
      this.$message.l;
      let timeId = setInterval(async () => {
        if (saveDatas.length === 0) {
          clearInterval(this.timeId);
          this.timeId = null;
          this.writing = false;
          return;
        } else {
          const type = saveDatas[0];
          if (this.eName && this.eName === `save-${type}`) {
            if (this.eDone) {
              console.log(type, this.eName, this.eDone);
              saveDatas.shift();
              this.eName = '';
              this.eDone = false;
            }
          } else {
            this.eName = `save-${type}`;
            this.eDone = false;
            await this.saveParamsHandle(type, this.allParams[type]);
          }
        }
      }, 400);
      this.timeId = timeId;
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
        &.disabled {
          cursor: not-allowed;
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
