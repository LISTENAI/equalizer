<template>
  <div class="main-page">
    <div class="top-banner flex">
      <div class="left flex" style="gap: 8px">
        <el-select v-model="com" placeholder="请选择" size="default" :loading="comsLoading" @visible-change="getComs"
          :disabled="connected || connecting">
          <el-option v-for="item in coms" :key="item.path" :label="item.path" :value="item.path">
          </el-option>
        </el-select>
        <el-autocomplete v-model="baudrate" :fetch-suggestions="queryBaudrate" placeholder="波特率" size="default"
          :disabled="connected || connecting" :trigger-on-focus="true" @select="handleSelect"></el-autocomplete>
        <el-button size="small" @click="connectHandle" :disabled="connecting || !com || !baudrate" :loading="connecting">
          {{ connected && !connecting ? '断开' : '连接'
          }}{{ connecting ? '中' : '' }}</el-button>
        <span class="flex">
          <svg-icon v-if="connecting" icon-class="r_connecting" class="icon" />
          <svg-icon v-else :icon-class="connected ? 'r_connected' : 'r_disconnected'" class="icon" />
          <span v-if="!connecting"> {{ connected ? '已' : '未' }}连接</span>
        </span>
      </div>
      <div class="right flex">
        <el-select v-model="fs" placeholder="请选择" size="default" @change="changeFsHandle"
          :disabled="connected || connecting">
          <el-option v-for="item in SampleRates" :key="item.value" :label="item.label" :value="item.value">
          </el-option>
        </el-select>
        <div class="opt-btn flex" :class="!connected || loading || writing ? 'disabled' : ''" @click="getAllParams">
          <svg-icon icon-class="get" class="icon" />
          <span>获取参数</span>
        </div>
        <div class="opt-btn flex margin" v-loading="writing" :class="!connected || loading || writing ? 'disabled' : ''"
          @click="saveAllParamsHandle" element-loading-spinner="el-icon-loading">
          <svg-icon icon-class="write" class="icon" />
          <span>{{ writing ? '写入中' : '写入参数' }}</span>
        </div>
        <div class="opt-btn flex" :class="Object.keys(params).length ? '' : 'disabled'" @click="exportBinFile">
          <svg-icon icon-class="export" class="icon" />
          <span>导出bin文件</span>
        </div>
      </div>
    </div>
    <!-- <p>页面的参数:{{ params }}</p>
    <p>{{ originVoiceType }}</p> -->

    <div class="listen-card flex">
      <div>均衡器参数组</div>
      <el-select v-model="activeEqParamIndex" placeholder="请选择" size="default" style="width: 100px;"
        :disabled="!connected || (loading || writing) || decoding" @change="changeEqParamsIndex">
        <el-option v-for="item in eqParams" :key="item" :label="item" :value="item">
        </el-option>
      </el-select>
      <el-button size="small" :disabled="!connected || decoding || (loading || writing)" @click="chooseAudioFile">
        测试播放音频
      </el-button>
      <el-button size="small" :disabled="!decoding || (loading || writing)" @click="stopAudioPlay">停止播放音频</el-button>
      <el-input v-model="ttsText" style="width: 240px;" size="default" placeholder="输入合成文本"></el-input>
      <el-button size="small" :disabled="!connected || (loading || writing) || decoding" @click="sendTts">
        测试合成文本
      </el-button>
    </div>

    <div class="container flex" v-loading="loading || writing">
      <div class="progress flex">
        <div class="step text">输入</div>
        <div class="step flex" v-for="item in options" :key="item.text">
          <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
          <div class="flex box">
            <img :src="require('@/assets/imgs/' + item.imageUrl)" />
            <p class="text">{{ item.text }}</p>
            <el-button :disabled="item.enable" @click="() => opreateHandle(item)">设置</el-button>
            <!-- || (!Object.keys(project).length && !connected) -->
            <el-checkbox v-model="item.enable" @change="() => changeBypass(item)">Bypass</el-checkbox>
          </div>
        </div>

        <div class="step flex arrow-part">
          <div class="flex">
            <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
            <span class="single-text">L</span>
            <img :src="require('@/assets/imgs/' + soundImgUrl)" class="sound-img" />
          </div>
          <div class="text">输出</div>
          <div class="flex">
            <img :src="require('@/assets/imgs/' + arrowImgUrl)" class="arrow" />
            <span class="single-text">R</span>
            <img :src="require('@/assets/imgs/' + soundImgUrl)" class="sound-img" />
          </div>
        </div>
      </div>
    </div>

    <VoiceModal v-if="voiceVisible" :visible="voiceVisible" :checkable="voiceCheckable"
      :voiceData="voiceData[currentModalType]" @close="closeModal" @reset="resetModalData" @save="saveHandle" />
    <EQModal v-if="eqVisible" :visible="eqVisible" :checkable="eqCheckable" :eqData="eqData" @close="closeModal"
      @reset="resetModalData" @save="saveHandle" />
    <DRCModal v-if="drcVisible" :visible="drcVisible" :checkable="drcCheckable" :drcData="drcData" @close="closeModal"
      @reset="resetModalData" @save="saveHandle" />
  </div>
</template>
<script>
import VoiceModal from 'components/VoiceModal.vue';
import EQModal from 'components/EqModal.vue';
import DRCModal from 'components/DRCModal.vue';
import { SerialPortProxy, getList } from '../utils/serialPortProxy';
import { checkConnect, setParams, getParams, activeEqParams, synthTts, getPcmFrame } from '../utils/index';
import { mapState } from 'vuex';
import defaultConfig from '../utils/config';
const TYPES = ['eq', 'bass_boost', 'treble_boost', 'drc', 'agc'];
export default {
  name: 'main-page',
  components: { VoiceModal, EQModal, DRCModal },
  data() {
    return {
      coms: [],
      baudrate: "115200",
      presetBaudrates: [
        300, 600, 1200, 2400, 4800,
        9600, 14400, 19200, 38400, 56000,
        57600, 115200, 128000, 256000,
        460800, 512000, 750000, 921600,
        1500000, 3000000
      ],
      activeEqParamIndex: null,
      eqParams: [
        "0001",
        "0002",
        "0003",
        "0004",
        "0005",
      ],
      SampleRates: [
        {
          value: 16000,
          label: 'Music Manager 16K',
        },
        {
          value: 48000,
          label: 'Music Manager 48K',
        },
      ],
      fs: this.rate, //采样率
      com: '',
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
          enable: true,
        },
        {
          type: 'treble_boost',
          text: '高音增强',
          imageUrl: 'high.png',
          enable: true,
        },
        {
          type: 'eq',
          text: 'EQ均衡器',
          imageUrl: 'eq.png',
          enable: true,
        },
        {
          type: 'drc',
          text: 'DRC',
          imageUrl: 'drc.png',
          enable: true,
        },
        {
          type: 'agc',
          text: '输出增益',
          imageUrl: 'out.png',
          enable: true,
        },
      ],
      voiceType: {
        bass_boost: {
          title: '低音增强',
          item: [
            {
              type: 'gain',
              value: 0,
              max: 100,
              min: -100,
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
              max: 100,
              min: -100,
              desc: '高音增强增益',
              unit: 'dB',
            },
            {
              type: 'freq',
              value: 1000,
              max: 20000,
              min: 1000,
              desc: '高音增强截止频率',
              unit: 'Hz',
            },
          ],
        },
        agc: {
          title: '输出',
          item: [
            {
              type: 'vol',
              value: 0,
              max: 0,
              min: -100,
              desc: '增益',
              unit: 'dB',
            },
          ],
        },
        eq: [
          [0, 3, this.fs, 0.707, 0, 26],
          [0, 3, this.fs, 0.707, 0, 40],
          [0, 3, this.fs, 0.707, 0, 63],
          [0, 3, this.fs, 0.707, 0, 80],
          [0, 3, this.fs, 0.707, 0, 125],
          [0, 3, this.fs, 0.707, 0, 250],
          [0, 3, this.fs, 0.707, 0, 500],
          [0, 3, this.fs, 0.707, 0, 1000],
          [0, 3, this.fs, 0.707, 0, 2000],
          [0, 3, this.fs, 0.707, 0, 2500],
        ],
        drc: {
          seg: 4,
          at: 0.1,
          rt: 0.5,
          rms: 0.1,
          mode: 1,
          dots: [],
        },
      },
      ttsText: '',
      originOptions: [],
      originVoiceType: [],
      eqType: {},
      currentModalType: '',
      voiceVisible: false,
      voiceCheckable: true, // 低音/高音/输出 bypass
      voiceData: {}, // 低音/高音/输出 数据
      eqVisible: false,
      eqCheckable: true, // EQ bypass
      eqData: [], // EQ 数据
      drcVisible: false,
      drcCheckable: true, // drc bypass
      drcData: null, // drc 数据
      // allParams: {}, //最终写入的参数
      eName: '',
      eDone: false,
      timeId: null,
      timeOutid: null,
      decoding: false,
      sendFirstFrame: false,
    };
  },
  mounted() {
    this.getComs();
    this.setInitData();
    SerialPortProxy.mount();
    SerialPortProxy.on('sp-sample-rate', this.receiveFs)
    SerialPortProxy.on('sp-eq-params', this.receiveParams)
    SerialPortProxy.on('sp-update-audio-state', this.receiveAudioState)

    if (localStorage.getItem('last_baudrate')) {
      this.baudrate = localStorage.getItem('last_baudrate');
    }
    if (localStorage.getItem('last_sampleRate')) {
      const fs = localStorage.getItem('last_sampleRate');
      const selected = this.SampleRates.find(item => item.value == fs);
      if (selected) {
        this.fs = selected.value;
      }
    }
  },
  unmounted() {
    this.clearInterval();
    this.clearTimeout();
    SerialPortProxy.unmount();
    SerialPortProxy.off('sp-sample-rate', this.receiveFs)
    SerialPortProxy.off('sp-eq-params', this.receiveParams)
    SerialPortProxy.off('sp-update-audio-state', this.receiveAudioState)
  },

  computed: {
    ...mapState({
      project: (state) => state.Project.project,
      params: (state) => state.Project.params,
      reset: (state) => state.Project.reset,
      rate: (state) => state.Project.rate,
      fsMutex: (state) => state.Project.fsMutex,
      connect: (state) => state.Project.connect,
    }),
  },
  watch: {
    connect: {
      handler(v) {
        this.connected = v;
      },
      immediate: true,
    },
    connected(v) {
      // if (!v) {
      //   this.com = '';
      // }
      this.loading = false;
      this.connecting = false;
      this.clearInterval();
      this.clearTimeout();
    },
    reset(v) {
      v && this.setInitData();
    },
    params: {
      handler(val) {
        const data = JSON.parse(JSON.stringify(val));
        Object.keys(data).forEach((key) => {
          this.parseData(key, data[key]);
        });
      },
      deep: true,
    },
    // 采样率修改会有以下影响：
    // 1：所有模块的下发fs参数
    // 2：eq和高音增强的频率
    //      eq的频率范围 48KHZ (20-20k) 16KHZ (20-8k)
    //      高音增强的截止频率 48KHZ (1k-20k) 16KHZ (1k-8k)
    // 3：需要重置已设置的参数（打开文件和获取固件的参数同步界面采样率，不需要重置页面数据）
    rate: {
      handler(v) {
        const maxFC = v === 48000 ? 20000 : 8000;
        this.fs = v;
        this.voiceType.treble_boost.item.map((obj) => {
          if (obj.type === 'freq') {
            obj.max = maxFC;
          }
          return obj;
        });
        if (this.fsMutex) {
          this.$store.dispatch('saveParams', {});
          this.setInitData();
        }
      },
      immediate: true,
    },
    fs(v) {
      this.$store.dispatch('changeRate', v);
    },
  },
  methods: {
    async receiveFs(args) {
      console.log(args);
      const { sampleRate } = args;
      if (this.timeOutid && sampleRate != -1) {
        clearTimeout(this.timeOutid);
        this.timeOutid = null;

        //这里的采样率需要从固件获取
        //只有确认采样率一致才能进入连接逻辑
        await this.changeConnectHandle(true, sampleRate);
      }
    },
    async receiveParams(args) {
      if (args[this.eName]) {
        this.eDone = true;
      }
      const newParams = Object.assign(this.params, args);
      console.log(newParams);
      this.$store.dispatch('saveParams', newParams);
    },
    async receiveData(e, res) {
      if (this.connected) {
        const { data, index } = res;
        console.log('receive data event', index, data.length, new Date().getTime());

        if (!this.sendFirstFrame) {
          this.sendFirstFrame = true;
          await this.writeSerialPortHandle(getPcmFrame(data, 0xf0));
        } else {
          await this.writeSerialPortHandle(getPcmFrame(data, 0xf1));
        }
      }
    },
    receiveAudioState(args) {
      const { isPlaying } = args;
      this.decoding = isPlaying;
    },
    queryBaudrate(queryString, cb) {
      try {
        var results = queryString ? this.presetBaudrates.filter(item =>
          item.toString().includes(queryString)
        ) : this.presetBaudrates;
        // 调用 callback 返回建议列表的数据
        console.log(results);
        cb(results.map(item => { return { value: item.toString() } }));
      } catch (e) {
        console.error(e);
      }
    },
    handleSelect(item) {
      console.log(item);
    },

    //赋默认值
    setInitData() {
      this.voiceType?.eq?.map((item) => (item[2] = this.rate));
      this.originOptions = JSON.parse(JSON.stringify(this.options));
      this.originVoiceType = JSON.parse(JSON.stringify(this.voiceType));
      // console.log('重置页面参数');
      TYPES.forEach((item) => {
        this.resetModalData(item);
      });
      this.$store.dispatch('changeReset', false);
    },

    async setEqParamsIndex(index) {
      if (!this.connected) {
        return;
      }
      try {
        console.log('enable eq params index -->', index);
        await this.writeSerialPortHandle(activeEqParams(index));
        await this.getAllParams();
      } catch (error) {
        console.error(error);
      }
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
    },

    async writeSerialPortHandle(params, errorCb) {
      try {
        const result = await SerialPortProxy.write(params);
        console.log('write serial', result);
        return result;
      } catch (error) {
        errorCb && errorCb();
        const message = error.message || '写入参数失败请重试'
        this.$message.error(message);
        return { code: -1, message }
      }
    },
    async getComs() {
      this.comsLoading = true;
      const res = await getList();
      this.coms = res;
      this.comsLoading = false;
    },
    open(link) {
      this.$electron.shell.openExternal(link);
    },
    clearTimeout() {
      this.timeOutid && clearTimeout(this.timeOutid);
      this.timeOutid = null;
    },
    clearInterval() {
      this.timeId && clearInterval(this.timeId);
      this.timeId = null;
    },
    async connectHandle() {
      try {
        let baudrate = 0;
        try {
          baudrate = Number(this.baudrate);
          if (!baudrate) {
            this.$confirm("请输入正确的波特率", '', {
              showCancelButton: false,
              showClose: false,
              closeOnClickModal: false,
              confirmButtonText: '确定',
              type: 'warning',
            });
            return;
          }
        } catch (e) {
          this.$confirm("请输入正确的波特率", '', {
            showCancelButton: false,
            showClose: false,
            closeOnClickModal: false,
            confirmButtonText: '确定',
            type: 'warning',
          });
          return;
        }
        if (this.connected) {
          const result = await SerialPortProxy.close();
          console.log('close result', result);
          this.$store.dispatch('changeConnect', false);
          this.writing = false;
          this.loading = false;
          this.clearTimeout();
        } else {
          this.connecting = true;
          const result = await SerialPortProxy.open(
            { port: this.com, baudRate: baudrate }
          );
          console.log("open result", result);
          if (result.code == 0) {
            const connectResult = await SerialPortProxy.verifyConnection();
            console.log('verify connection', connectResult);
            if (connectResult.code == 0) {
              // 等待返回 fs
              this.timeOutid = setTimeout(() => {
                this.$store.dispatch('changeConnect', false);
                this.connecting = false;
                this.writing = false;
                this.loading = false;
                this.$confirm('连接超时，请重试', '', {
                  showCancelButton: false,
                  showClose: false,
                  closeOnClickModal: false,
                  confirmButtonText: '确定',
                  type: 'warning',
                }).then(() => {
                  SerialPortProxy.close();
                  return;
                });
              }, 5000);
            } else {
              this.$confirm(connectResult.message, '', {
                showCancelButton: false,
                showClose: false,
                closeOnClickModal: false,
                confirmButtonText: '确定',
                type: 'warning',
              });
            }
          } else {
            SerialPortProxy.close();
            this.connecting = false;
            // this.connected = false;
            this.$store.dispatch('changeConnect', false);
            this.writing = false;
            this.loading = false;
            this.clearTimeout();
            this.$confirm(result.message, '', {
              showCancelButton: false,
              showClose: false,
              closeOnClickModal: false,
              confirmButtonText: '确定',
              type: 'warning',
            }).then(() => {
              return;
            });
          }
        }
      } catch (error) {
        this.connecting = false;
        // this.connected = false;
        this.$store.dispatch('changeConnect', false);
        this.writing = false;
        this.loading = false;
        this.clearTimeout();
        this.$confirm(error, '', {
          showCancelButton: false,
          showClose: false,
          closeOnClickModal: false,
          confirmButtonText: '确定',
          type: 'warning',
        }).then(() => {
          return;
        });
      }
    },
    async checkConnectHandle() {
      try {
        const params = checkConnect();
        await this.writeSerialPortHandle(params);
      } catch (error) {
        await this.changeConnectHandle(false);
      }
    },
    saveOpenConfig() {
      localStorage.setItem('last_baudrate', this.baudrate);
      localStorage.setItem('last_sampleRate', this.fs);
    },
    async changeConnectHandle(isOk, fs) {
      //固件上报连接成功，判断固件和界面的采样率是否一致
      console.log('串口采样率', fs, this.rate);
      if (isOk) {
        if (fs && parseInt(fs) === parseInt(this.rate)) {
          this.connected = isOk;
          this.$store.dispatch('changeConnect', isOk);

          this.saveOpenConfig();

          let v = this.eqParams[0]
          this.activeEqParamIndex = v;
          await this.setEqParamsIndex(this.eqParams.indexOf(v) + 1);
          console.log('end setEqParamsIndex');
        } else {
          this.$confirm(
            '固件采样率和界面不一致，请修改界面采样率后再进行连接',
            '',
            {
              showCancelButton: false,
              showClose: false,
              closeOnClickModal: false,
              confirmButtonText: '确定',
              type: 'warning',
            }
          ).then(async () => {
            await SerialPortProxy.close();
            // this.connected = false;
            this.$store.dispatch('changeConnect', false);
          });
        }
      } else {
        //串口已经打开，但是固件返回连接状态失败
        await SerialPortProxy.close();
      }
      this.connecting = false;
      this.clearTimeout();
    },
    changeBypass(item) {
      const params = JSON.parse(JSON.stringify(this.params));
      if (params[item.type]) {
        params[item.type].enable = !item.enable;
      } else {
        params[item.type] = { enable: !item.enable };
      }
      this.$store.dispatch('saveParams', params);
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
      this.eqVisible = true;
      this.currentModalType = item.type;
      this.eqCheckable = item.enable;
    },
    async openDRCModal(item) {
      this.currentModalType = item.type;
      this.drcCheckable = item.enable;
      this.drcVisible = true;
      console.log(this.drcData);
    },
    async openVoiceModal(item) {
      console.log(this.voiceData);
      this.voiceVisible = true;
      this.currentModalType = item.type;
      this.voiceCheckable = item.enable;
    },
    parseData(type, data) {
      this.enableVoice(type, !data.enable);
      switch (type) {
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
      modalData.map((item) => (item[2] = this.fs));
      if (data) {
        let { filters, enable } = data;
        this.eqCheckable = !enable;
        if (filters) modalData = filters;
      }
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
      modalData.fs = this.fs;
      if (data) {
        let { fs, at, rt, rms, mode, seg, dots, enable } = data;
        this.drcCheckable = !enable;
        if (seg)
          modalData = {
            fs,
            at,
            rt,
            rms,
            mode,
            seg,
            dots: dots?.map((item) => {
              return { x: item[0], y: item[1], w: item[2] };
            }),
          };
      }
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
      modalData.item[0].sr = this.fs;
      modalData.type = 'agc';
      if (data) {
        const { sr, vol } = data;
        modalData.item[0].value = vol;
        modalData.item[0].sr = sr;
      }
      this.voiceData['agc'] = modalData;
    },
    parseVoiceData(type, data) {
      let modalData = JSON.parse(JSON.stringify(this.voiceType[type]));
      modalData.type = type;
      if (data) {
        const { gain, freq } = data;
        if (gain === undefined) return;
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
      }
      modalData.fs = data.fs || this.fs;
      this.voiceData[type] = modalData;
    },
    async chooseAudioFile() {
      const res = await this.$electron.ipcRenderer.invoke('open-file', {
        filters: [
          {
            name: '音频',
            extensions: ['mp3', 'wav', 'pcm'],
          },
        ],
        properties: ['openFile'],
      });
      const { code, data } = res;
      if (res) {
        SerialPortProxy.playAudioFile({ file: data[0] });
      }
    },
    async stopAudioPlay() {
      SerialPortProxy.cancelAudioFile();
    },
    async sendTts() {
      try {
        console.log(`synth tts ${this.ttsText}`);
        const data = synthTts(this.ttsText);
        await this.writeSerialPortHandle(data);
      } catch (error) {
        console.error(error);
      }
    },
    resetModalData(type) {
      const voiceData = JSON.parse(JSON.stringify(this.originVoiceType[type]));
      // console.log('reset', voiceData);
      this.enableVoice(type, true);
      switch (type) {
        case 'eq':
          this.eqData = voiceData;
          this.eqCheckable = true;
          break;
        case 'drc':
          this.drcData = voiceData;
          this.drcCheckable = true;
          break;
        default: //'bass_boost'|'treble_boost'|'agc'
          voiceData.type = type;
          this.voiceData[type] = voiceData;
          this.voiceCheckable = true;
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
      // console.log(type, val);
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
        this.options.splice(index, 1, voiceItem);
      }
    },
    async saveHandle(type, data) {
      if (type === 'agc') {
        data.sr = this.fs;
      } else {
        data.fs = this.fs;
      }
      this.parseData(type, data);
      const newParams = JSON.parse(JSON.stringify(this.params));
      newParams[type] = data;
      console.log(newParams);
      this.$store.dispatch('saveParams', newParams);
    },

    //单个写入设置
    async saveParamsHandle(type, data) {
      try {
        const params = setParams(type, data);
        const result = await this.writeSerialPortHandle(params);
        if (result.code != 0) {
          this.resetModalData(type);
        } else {
          if (this.eName == `save-${type}`) {
            this.eDone = true;
          }
        }
      } catch (error) {
        this.$message.error(error.message);
      }
    },
    //写入所有参数
    async saveAllParamsHandle() {
      if (!this.connected || this.loading || this.writing) return;
      if (Object.keys(this.params).length === 0) {
        return this.$message.error('请先设置参数');
      }
      const finalParams = this.mergeParams();
      let saveDatas = Object.keys(finalParams);
      console.log('写入参数', finalParams);
      const timeOutid = setTimeout(() => {
        this.clearInterval();
        this.writing = false;
        this.$confirm('写入超时，请重试', '', {
          showCancelButton: false,
          showClose: false,
          closeOnClickModal: false,
          confirmButtonText: '确定',
          type: 'warning',
        }).then(() => {
          return;
        });
      }, 15000);
      this.timeOutid = timeOutid;
      this.writing = true;
      let timeId = setInterval(async () => {
        if (saveDatas.length === 0) {
          this.clearInterval();
          this.clearTimeout();
          this.writing = false;
          this.$message.success('写入参数成功');
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
            await this.saveParamsHandle(type, finalParams[type]);
          }
        }
      }, 400);
      this.timeId = timeId;
    },
    async getAllParams() {
      const dataTypes = JSON.parse(JSON.stringify(TYPES));
      if (!this.connected || this.loading || this.writing) return;
      this.loading = true;
      // this.clearInterval();
      // this.clearTimeout();
      const timeOutid = setTimeout(() => {
        this.clearInterval();
        this.loading = false;
        this.eName = '';
        this.eDone = false;
        this.$confirm('获取超时，请重试', '', {
          showCancelButton: false,
          showClose: false,
          closeOnClickModal: false,
          confirmButtonText: '确定',
          type: 'warning',
        }).then(() => {
          return;
        });
      }, 15000);
      this.timeOutid = timeOutid;
      let timeId = setInterval(async () => {
        if (dataTypes.length === 0) {
          this.clearInterval();
          this.clearTimeout();
          this.loading = false;
          this.eName = '';
          this.eDone = false;
          // 设置页面的采样率为获取低音增强的采样率
          this.$store.dispatch('changeFsReset', false);
          this.params?.drc?.fs &&
            this.$store.dispatch('changeRate', parseInt(this.params?.drc?.fs));
          this.$message.success('获取参数成功');
          console.log('所有参数');
          console.log(this.params);
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
    async exportBinFile() {
      if (Object.keys(this.params).length === 0) {
        return;
      }
      const finalParams = this.mergeParams();
      const pathStr = await this.$electron.ipcRenderer.invoke('open-dict');
      console.log('导出', finalParams);
      if (pathStr) {
        const binPath = this.project?.manifestJson?.name
          ? this.project?.manifestJson?.name + '.bin'
          : '未命名-1.bin';
        const res = await this.$electron.ipcRenderer.invoke(
          'write-bin',
          pathStr,
          binPath,
          finalParams
        );
        if (res === 0) {
          this.$message.success(`${binPath}导出成功`);
        } else {
          this.$message.error('导出失败');
        }
      }
    },
    changeEqParamsIndex(v) {
      this.$confirm(
        '切换参数值会从固件中读取参数并覆盖当前参数，如有修改请先保存现有编辑参数',
        '是否确定切换参数组',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(async () => {
          this.activeEqParamIndex = v;
          await this.setEqParamsIndex(this.eqParams.indexOf(v) + 1);
        })
        .catch(() => {
          return;
        });
    },
    changeFsHandle(v) {
      if (Object.keys(this.params).length === 0) {
        this.$store.dispatch('changeFsReset', true);
        this.fs = v;
        return;
      }
      this.$confirm(
        '切换采样率会重置参数，如有修改请先保存现有编辑参数',
        '是否确定切换采样率',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(() => {
          this.$store.dispatch('changeFsReset', true);
          this.fs = v;
        })
        .catch(() => {
          return;
        });
    },
    mergeParams() {
      //drc.dots不能进行merge ,不同段数dots长度不同
      const dotsArr = this.params?.drc?.dots;
      const defaultParams = defaultConfig(this.fs);
      let finalParams = _.merge(_.cloneDeep(defaultParams), this.params);
      finalParams.drc.dots = dotsArr?.length ? dotsArr : finalParams.drc.dots;
      return finalParams;
    },
  },
};
</script>
<style lang="scss" scoped>
.main-page {
  background-color: $background;
  height: calc(100% - 30px);
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
    }

    .left {
      .el-select {
        width: 160px;
      }

      .el-autocomplete {
        margin-left: 8px;
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

  .listen-card {
    min-height: 54px;
    background: #ffffff08;
    border-radius: 0px 0px 8px 0px;
    padding: 0px 16px;
    gap: 8px;
  }

  .container {
    width: 100%;
    height: calc(100vh - 86px);
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
