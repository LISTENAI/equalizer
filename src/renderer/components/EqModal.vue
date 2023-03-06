<template>
  <el-dialog
    title="EQ均衡器"
    :visible="show"
    width="880px"
    top="40px"
    class="eq-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="beforeCloseHandle"
  >
    <div class="container">
      <div ref="dom" id="chart" class="charts chart-bar"></div>
      <div class="band-list flex">
        <div class="labels flex">
          <p></p>
          <p>频率(Hz)</p>
          <p>增益(dB)</p>
          <p>Q/宽广度</p>
          <p>类型</p>
        </div>

        <div
          class="band flex"
          v-for="(item, key) in bandsData"
          :key="key"
          :class="[
            activeIndex === key ? 'active' : '',
            item.enable ? '' : 'disabled',
          ]"
          @mouseover="() => activeHandle(item.enable, key, true)"
          @mouseleave="() => activeHandle(item.enable, key, false)"
        >
          <el-checkbox
            :label="`频段${key + 1}`"
            v-model="item.enable"
            @change="(v) => changeenable(v, key)"
          ></el-checkbox>
          <el-input-number
            v-model="item.fc"
            controls-position="right"
            :min="boundaryVal.minFC"
            :max="boundaryVal.maxFC"
            size="mini"
            :disabled="!item.enable"
            @change="mutex = false"
          ></el-input-number>
          <el-input-number
            v-model="item.gain"
            controls-position="right"
            :min="boundaryVal.mindB"
            :max="boundaryVal.maxdB"
            :precision="1"
            :step="0.1"
            size="mini"
            :disabled="!item.enable"
            @change="mutex = false"
          ></el-input-number>
          <el-input-number
            v-model="item.q"
            controls-position="right"
            :min="boundaryVal.minQ"
            :max="boundaryVal.maxQ"
            :precision="3"
            :step="0.001"
            size="mini"
            :disabled="!item.enable"
            @change="mutex = false"
          ></el-input-number>
          <el-select
            v-model="item.type"
            size="mini"
            :ref="'select' + key"
            @change="changeType($event, key)"
            popper-class="type-select"
            :disabled="!item.enable"
          >
            <el-option
              v-for="type in types"
              :label="type.label"
              :value="type.val"
              :key="type.val"
            >
              <p class="type-label">
                <span>{{ type.label }}</span>
                <img
                  :src="require('@/assets/imgs/' + type.imgUrl)"
                  class="type-img"
                />
              </p>
            </el-option>
          </el-select>
        </div>
      </div>
    </div>

    <span slot="footer" class="dialog-footer">
      <div class="fl">
        <el-button @click="resetHandle">重置</el-button>
        <el-checkbox v-model="enable">Bypass</el-checkbox>
      </div>
      <el-button type="primary" @click="saveHandle">确 定</el-button>
      <el-button @click="beforeCloseHandle">取 消</el-button>
    </span>
  </el-dialog>
</template>

<script>
import * as echarts from 'echarts';
import _ from 'lodash';
import { mapState } from 'vuex';

export default {
  name: 'EqModal',
  props: {
    eqData: {
      type: Array,
      default: () => {
        return [];
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
  },

  data() {
    return {
      activeIndex: null,
      type: 'eq',
      enable: this.checkable,
      symbolSize: 16, // 通过拖动是可以实时改变这里的值的
      boundaryVal: {
        maxdB: 30,
        mindB: -30,
        maxFC: 20000,
        minFC: 20,
        minQ: 0.3,
        maxQ: 30,
      },
      pointsData: [],
      linesData: [],
      types: [
        {
          val: 0,
          label: 'LowPass',
          imgUrl: 'eq_LowPass.png',
        },
        {
          val: 1,
          label: 'HighPass',
          imgUrl: 'eq_HighPass.png',
        },
        {
          val: 2,
          label: 'Peaking',
          imgUrl: 'eq_Peaking.png',
        },
        {
          val: 3,
          label: 'lowShelf',
          imgUrl: 'eq_lowShelf.png',
        },
        {
          val: 4,
          label: 'HighShelf',
          imgUrl: 'eq_HighShelf.png',
        },
      ],
      bandsData: this.eqData,
      show: this.visible,
      detail: {},
      chartDom: null,
      mutex: false,
    };
  },
  watch: {
    eqData: {
      async handler(val) {
        const newVal = _.cloneDeep(val);
        await this.parseEqData(newVal);
        this.enable = this.checkable;
      },
      deep: true,
    },
    bandsData: {
      async handler(val) {
        if (!this.mutex && val) {
          const newVal = _.cloneDeep(val);
          this.getPointsData(newVal);
          await this.getLinesData(newVal);
          setTimeout(this.resetTypeSelect, 0);
          setTimeout(this.renderChart, 0);
        }
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
    rate: {
      handler(v) {
        const maxFC = v === 48000 ? 20000 : 8000;
        this.boundaryVal.maxFC = maxFC;
      },
      immediate: true,
    },
  },
  computed: {
    ...mapState({
      rate: (state) => state.Project.rate,
    }),
  },
  mounted() {
    this.parseEqData(JSON.parse(JSON.stringify(this.eqData)));
  },
  beforeDestroy() {
    this?.chartDom.dispose();
  },
  methods: {
    async updateBandsData(that, val) {
      const newVal = _.cloneDeep(val);
      that.getPointsData(newVal);
      await that.getLinesData(newVal);
      setTimeout(that.resetTypeSelect, 0);
      setTimeout(that.renderChart, 0);
    },
    async parseEqData(data) {
      this.mutex = true;
      const points = [];
      const filters = data.map((item) => {
        const [enable, type, dSampleRateHz, q, gain, fc] = item;
        points.push([fc, gain]);
        return {
          enable: !!enable,
          type,
          dSampleRateHz: dSampleRateHz || 48000,
          q,
          gain,
          fc,
        };
      });
      this.bandsData = _.cloneDeep(filters);
      this.pointsData = points;
      await this.getLinesData(filters);
      setTimeout(this.initChart, 0);
      setTimeout(this.resetTypeSelect, 0);
    },
    getBandsData(val) {
      const data = _.cloneDeep(val);
      return data.map((item) => {
        item.enable = item.enable === undefined ? true : !!item.enable;
        return item;
      });
    },
    getPointsData(data) {
      const arr = data.map((item) => {
        return [item.fc, item.gain];
      });
      this.pointsData = arr;
      return arr;
    },
    async getLinesData(data) {
      const { maxdB, mindB, maxFC, minFC } = this.boundaryVal;
      const filters = JSON.parse(JSON.stringify(data));
      filters.map((item) => (item.enable = item.enable ? 1 : 0));
      const params = {
        enable: !this.enable,
        filters,
      };
      const options = {
        startFreq: minFC,
        endFreq: maxFC,
        startGain: mindB,
        endGain: maxdB,
        xNum: 280,
        yNum: 370,
      };
      const res = await this.$electron.ipcRenderer.invoke(
        'eq-draw',
        params,
        options
      );
      this.linesData = res.points;
      return res.points;
    },
    dragHandle: _.debounce(async (that, data) => {
      const linesData = await that.getLinesData(data);
      that.chartDom.setOption({
        series: [
          {
            id: 'line',
            data: linesData,
          },
        ],
      });
      // that.renderGraphicList();
    }, 100),

    convertToPixel(dataItem) {
      return this.chartDom && this.chartDom.convertToPixel('grid', dataItem);
    },
    getMarkLineArr() {
      const arr = [];
      let num = this.boundaryVal.minFC;
      while (num < this.boundaryVal.maxFC) {
        if (num < 1e2) {
          num = num + 1e1;
          arr.push({
            xAxis: num,
          });
        } else if (num >= 1e2 && num < 1e3) {
          num = num + 1e2;
          arr.push({
            xAxis: num,
          });
        } else if (num >= 1e3 && num < 1e4) {
          num = num + 1e3;
          arr.push({
            xAxis: num,
          });
        } else {
          num = num + 1e4;
          arr.push({
            xAxis: num,
          });
        }
      }
      return arr;
    },
    initChart() {
      const that = this;
      this.chartDom = echarts && echarts.init(this.$refs.dom);
      const markLineArr = this.getMarkLineArr();
      const option = {
        animation: false,
        grid: {
          left: 50,
          right: 10,
          top: 10,
          bottom: 20,
        },
        tooltip: {
          triggerOn: 'none',
          position: 'top',
          formatter(params) {
            const data = params.data || [0, 0];
            const item = that.bandsData[params.dataIndex];
            const index = parseInt(params.dataIndex) + 1;
            // console.log(params.dataIndex);
            return (
              '频段: ' +
              index +
              '<br>频率: ' +
              data[0].toFixed(0) +
              'Hz' +
              '<br>增益: ' +
              data[1].toFixed(1) +
              'dB' +
              '<br>宽广度: ' +
              item.q
            );
          },
        },
        xAxis: {
          min: this.boundaryVal.minFC,
          max: this.boundaryVal.maxFC,
          type: 'log',
          // boundaryGap: false,
          axisLabel: {
            color: '#ccc',
            formatter(value) {
              return value >= 1000 ? value / 1000 + 'k' : value;
            },
          },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: {
            show: false,
          },
        },
        yAxis: {
          min: -100,
          max: 100,
          splitNumber: 6,
          minInterval: 1,
          type: 'value',
          // boundaryGap: [0, '30%'],
          axisLabel: {
            color: '#ccc',
            formatter(value) {
              return parseInt(value) + ' dB';
            },
          },
          axisLine: {
            show: true,
            lineStyle: {
              color: ['rgba(255,255,255,0.1)'],
            },
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: ['rgba(255,255,255,0.1)'],
            },
          },
        },
        dataZoom: [
          {
            startValue: this.boundaryVal.mindB,
            endValue: this.boundaryVal.maxdB,
            type: 'inside',
            yAxisIndex: 0,
            moveOnMouseMove: 'shift',
            // preventDefaultMouseMove: false,
            filterMode: 'none',
          },
        ],
        series: [
          {
            id: 'point',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: (_value, params) => {
              return this.bandsData[params.dataIndex]?.enable
                ? this.symbolSize / 2
                : 0;
            },
            lineStyle: {
              color: '#ccc',
              width: 0,
            },
            itemStyle: {
              // 设置symbol的颜色
              color: 'rgba(255,255,255,0.5)',
            },
            data: this.pointsData,
          },
          {
            id: 'line',
            type: 'line',
            smooth: true,
            symbolSize: 0,
            lineStyle: {
              color: '#1D99FF',
              width: 1,
            },

            // areaStyle: {},
            areaStyle: {
              origin: 'start',
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: 'rgba(5,104,255,0.3)',
                },
                {
                  offset: 1,
                  color: 'rgba(5,104,255,0)',
                },
              ]),
            },
            data: this.linesData,
            markLine: {
              silent: true,
              symbol: ['none', 'none'], // 去掉箭头
              label: {
                show: false,
              },
              data: markLineArr,
              lineStyle: {
                type: 'solid',
                color: 'rgba(255,255,255,0.1)',
              },
            },
          },
        ],
      };
      this.chartDom.setOption(option);
      this.renderGraphicList();
      this?.chartDom?.on('datazoom', () => {
        this.renderGraphicList();
      });
    },
    renderGraphicList() {
      const graphicList = echarts.util.map(
        this.pointsData,
        (dataItem, dataIndex) => {
          const that = this;
          return {
            type: 'circle',
            shape: {
              r: that.symbolSize,
            },
            position: that.chartDom.convertToPixel('grid', dataItem),
            invisible: true,
            draggable: true,
            z: 100,
            onclick: function () {
              console.log(this.position);
            },
            onmousemove: function () {
              !that.draging && that.showTooltip(dataIndex);
            },
            onmouseout: function () {
              that.hideTooltip(dataIndex);
            },
            ondrag: echarts.util.curry(async function (dataIndex) {
              that.draging = true;
              that.mutex = true;
              const { maxdB, mindB, maxFC, minFC } = that.boundaryVal;
              // 实时获取拖动的点位信息并根据此信息重新画图
              let [fc, gain] = that.chartDom.convertFromPixel(
                'grid',
                this.position
              );
              fc = fc < minFC ? minFC : fc;
              fc = fc >= maxFC ? maxFC : fc;
              gain = gain <= mindB ? mindB : gain;
              gain = gain >= maxdB ? maxdB : gain;
              fc = parseInt(fc);
              //拖动点的时候 实时更新点的位置 延缓更新线
              // 设置 pointsData bandsData
              const data = _.cloneDeep(that.pointsData);
              const bandsData = _.cloneDeep(that.bandsData);
              bandsData[dataIndex] = Object.assign(bandsData[dataIndex], {
                fc,
                gain,
              });
              that.bandsData = bandsData;
              data[dataIndex] = [fc, gain];
              that.pointsData = data;
              that.chartDom.setOption({
                series: [
                  {
                    id: 'point',
                    data: data,
                  },
                  // {
                  //   id: 'line',
                  //   data: data,
                  // },
                ],
              });

              that.dragHandle(that, bandsData);
            }, dataIndex),
            ondragend: function () {
              that.draging = false;
              that.renderChart();
            },
          };
        }
      );
      this.chartDom.setOption({
        graphic: graphicList,
      });
    },
    renderChart() {
      // console.log('renderchart');
      if (!this.chartDom) return;
      this?.chartDom.setOption({
        series: [
          {
            id: 'point',
            data: this.pointsData,
          },
          {
            id: 'line',
            data: this.linesData,
          },
        ],
      });
      this.renderGraphicList();
    },
    resize() {
      // this.dom.resize();
    },
    saveHandle() {
      this.closeHandle();
      const data = this.bandsData.map((item) => {
        const { enable, type, dSampleRateHz, q, gain, fc } = item;
        return [enable ? 1 : 0, type, dSampleRateHz || 48000, q, gain, fc];
      });
      const params = { enable: !this.enable, filters: data };
      this.$emit('save', this.type, params);
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
      // this.resetHandle();
      this.$emit('close');
    },
    resetHandle() {
      this.$emit('reset', this.type);
      this.mutex = false;
    },
    resetTypeSelect() {
      this.bandsData.map((item, index) => {
        this.changeTypeImg(index, item);
      });
    },
    changeTypeImg(key, item) {
      const typeObj = this.types.find((type) => item.type === type.val);
      const opacity = item.enable ? 1 : 0.5;
      const img = typeObj?.imgUrl && require('@/assets/imgs/' + typeObj.imgUrl);
      img &&
        this.$refs[
          'select' + key
        ][0]?.$el.children[0]?.children[0].setAttribute(
          'style',
          'background-image:url(' +
            img +
            ');color: transparent;background-position: 6px 2px;background-repeat: no-repeat;background-size: 32px 16px;opacity:' +
            opacity +
            ';'
        );
    },
    changeType(e, key) {
      this.mutex = false;
      const item = this.types.find((item) => item.val === e);
      const img = item?.imgUrl && require('@/assets/imgs/' + item.imgUrl);
      this.$refs['select' + key][0].$el.children[0].children[0].setAttribute(
        'style',
        'background-image:url(' +
          img +
          ');color: transparent;background-position: 6px 2px;background-repeat: no-repeat;background-size: 32px 16px;'
      );
    },
    changeenable(v, key) {
      this.mutex = false;
      this.bandsData[key].enable = v;
      this.changeTypeImg(key, this.bandsData[key]);
    },
    showTooltip(key) {
      if (key === undefined) {
        return;
      }
      this.chartDom &&
        this.chartDom.dispatchAction({
          type: 'showTip',
          seriesIndex: 0,
          dataIndex: key,
        });
    },
    hideTooltip(key) {
      if (!key) {
        return;
      }
      this.chartDom &&
        this.chartDom.dispatchAction({
          type: 'hideTip',
          seriesIndex: 0,
          dataIndex: key,
        });
    },
    activeHandle(enable, key, isActive) {
      if (!enable) {
        this.activeIndex = null;
        return;
      }
      if (isActive) {
        this.activeIndex = key;
        this.showTooltip(key);
      } else {
        this.activeIndex = null;
        this.hideTooltip(key);
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.eq-dialog {
  .flex {
    display: flex;
  }
  .item {
    color: $font-color;
    justify-content: space-between;
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
  .charts {
    width: 840px;
    height: 250px;
  }
  .band-list {
    flex-shrink: 0;
    margin-top: 16px;
    color: #cccccc;
    width: 850px;
    height: 146px;

    justify-content: space-around;
    .labels {
      min-width: 56px;
      padding: 4px;
      height: 138px;
      margin-right: 8px;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      p {
        height: 16px;
      }
    }
    .band {
      padding: 4px;
      height: 138px;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      &.disabled {
        // opacity: 0.6;
      }
      &.active {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
      }
    }
    .el-input-number--mini {
      width: 64px;
    }
    .el-input-number.is-controls-right .el-input__inner {
      padding: 0;
    }
  }
}
.type-select {
  .type-label {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;
    height: 28px;
    justify-content: space-around;
    .type-img {
      // margin-left: ;
      width: 32px;
      height: 16px;
      margin-left: 20px;
    }
  }
}
</style>
