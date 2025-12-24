<template>
  <el-dialog
    title="DRC"
    v-model="show"
    width="750px"
    top="50px"
    class="drc-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="beforeCloseHandle"
  >
    <div class="container flex">
      <div ref="dom" id="chart" class="charts chart-bar"></div>
      <div class="band-list flex">
        <div class="menu-bar">
          <el-radio
            v-for="item in bandNums"
            :label="item"
            v-model="seg"
            @change="changeBandNums"
            :key="item"
            >{{ `${item}段` }}</el-radio
          >
        </div>
        <div class="band-con flex">
          <div
            class="band flex"
            v-for="(item, key) in bandsData"
            :key="key"
            :class="activeIndex === key ? 'active' : ''"
            @mouseover="() => activeHandle(key, true)"
            @mouseleave="() => activeHandle(key, false)"
          >
            <span>{{ key + 1 }}.</span>
            <span>X</span>
            <el-input-number
              v-model="item.x"
              :disabled="key === 0 || key === bandsData.length - 1"
              controls-position="right"
              :min="bandsData[key - 1]?.x"
              :max="bandsData[key + 1]?.x"
              size="small"
              @change="mutex = false"
            ></el-input-number>
            <span>Y</span>
            <el-input-number
              v-model="item.y"
              controls-position="right"
              :min="-100"
              :max="0"
              size="small"
              @change="mutex = false"
            ></el-input-number>
            <span>W</span>
            <el-input-number
              v-model="item.w"
              controls-position="right"
              :min="0"
              :max="20"
              size="small"
              @change="mutex = false"
            ></el-input-number>
            <span>dB</span>
          </div>
        </div>
        <div class="band-con flex other">
          <div class="list">
            <span>启动时间</span>
            <el-input-number
              v-model="at"
              controls-position="right"
              :min="0"
              :max="100"
              size="small"
            ></el-input-number>
            <i>ms</i>
          </div>
          <div class="list">
            <span>释放时间</span>
            <el-input-number
              v-model="rt"
              controls-position="right"
              :min="0"
              :max="1000"
              size="small"
            ></el-input-number>
            <i>ms</i>
          </div>
          <div class="list">
            <span>检测类型</span>
            <el-select v-model="mode" size="small">
              <el-option
                v-for="type in types"
                :label="type.label"
                :value="type.val"
                :key="type.val"
              >
              </el-option>
            </el-select>
          </div>
          <div class="list" v-if="mode !== 0">
            <span>检测时间</span>
            <el-input-number
              v-model="rms"
              controls-position="right"
              :min="0"
              :max="100"
              :step="1"
              size="small"
            ></el-input-number>
            <i>ms</i>
          </div>
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
import * as echarts from 'echarts';
import _ from 'lodash';
export default {
  props: {
    drcData: {
      type: Object,
      default: () => {
        return {};
      },
    },
    visible: {
      type: Boolean,
      default: false,
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
      bandNums: [3, 4, 5],
      type: 'drc',
      symbolSize: 10,
      drcVal: {
        maxY: 0,
        minY: -100,
        maxX: 0,
        minX: -100,
        defaultW: 3,
      },
      ranges: {},
      types: [
        {
          label: 'Peak',
          val: 0,
        },
        {
          label: 'RMS',
          val: 1,
        },
      ],
      enable: this.checkable,
      pointsData: [
        [-100, -100],
        [-75, -75],
        [-50, -50],
        [-25, -25],
        [0, 0],
      ], //拖动点的数据
      bandsData: [], //右侧操作频段的数据
      linesData: [], //曲线的数据
      fs: 48000, //采样率
      seg: 5, //段数
      at: 0.1, //启动时间
      rt: 0.5, //释放时间
      rms: 0.1, //检测时间
      mode: 0, //类型
      show: this.visible,
      chartDom: null,
      mutex: false, // 属性监听互斥锁
      originBandsData: {},
    };
  },
  watch: {
    //dots就是pointsData
    drcData: {
      handler(newVal) {
        if (!newVal) return;
        const { fs, at, rt, mode, rms, seg, dots } = newVal;
        this.fs = fs;
        this.at = at * 1000;
        this.rt = rt * 1000;
        this.rms = rms * 1000;
        this.seg = seg;
        this.mode = mode;
        this.mutex = false;
        this.enable = this.checkable;
        if (dots?.length) {
          this.bandsData = _.cloneDeep(dots);
        } else {
          const { bands } = this.getBandsData(this.seg || 5);
          this.bandsData = bands;
        }
      },
      deep: true,
      immediate: true,
    },

    bandsData: {
      async handler(val) {
        if (!this.mutex && val) {
          const newVal = _.cloneDeep(val);
          this.getPointsData(newVal);
          await this.getLinesData(newVal);
          setTimeout(this.renderChart, 0);
        }
      },
      deep: true,
      immediate: true,
    },
    checkable: function (newVal) {
      this.enable = newVal;
    },
    visible: function (newVal) {
      this.show = newVal;
      this.enable = this.checkable;
    },
  },

  mounted() {
    setTimeout(this.initChart, 0);
  },
  beforeDestroy() {
    this?.chartDom?.dispose();
  },
  methods: {
    getBandsData(num) {
      if (!num) return [];
      const originBandsData = this.originBandsData[num];

      if (originBandsData) {
        const { charts, bands } = originBandsData;
        return { charts, bands };
      }
      const { minX, minY, maxX, maxY, defaultW } = this.drcVal;
      const Xrange = -parseInt((maxX - minX) / num);
      const Yrange = -parseInt((maxY - minY) / num);
      const bandArr = [];
      const chartArr = [];
      for (let i = num; i >= 0; i--) {
        i === num
          ? bandArr.push({
              x: -100,
              y: -100,
              w: defaultW,
            })
          : bandArr.push({
              x: Xrange * i,
              y: Yrange * i,
              w: defaultW,
            });

        chartArr.push([Xrange * i, Yrange * i]);
      }
      return { charts: chartArr, bands: bandArr };
    },
    // params:bandsData
    getPointsData(data) {
      const arr = data.map((item) => {
        return [item.x, item.y];
      });
      this.pointsData = arr;
      return arr;
    },
    // params:bandsData
    getDotsData(data) {
      return data.map((item) => [item.x, item.y, item.w]);
    },
    // params:bandsData
    async getLinesData(data) {
      console.log('getlinesData');
      this.mutex = true;
      const { maxX, minX, maxY, minY } = this.drcVal;
      const dots = _.cloneDeep(this.getDotsData(data));
      let { fs, enable, at, rt, mode, rms, seg } = this;
      const params = {
        enable: !enable,
        fs: fs,
        at: at / 1000,
        rt: rt / 1000,
        mode,
        rms: rms / 1000,
        seg,
        dots,
      };
      const options = {
        WidthX: 80,
        HeightY: 100,
        startXGain: minX,
        endXGain: maxX,
        startYGain: minY,
        endYGain: maxY,
      };
      const res = await window.ipcRenderer.invoke(
        'drc-draw',
        params,
        options
      );
      const arr = res.dots.map((item) => {
        return { x: item[0], y: item[1], w: item[2] };
      });
      this.bandsData = arr;
      this.linesData = res.points;
      // this.pointsData = res.dots;
      // console.log('this.pointsData', this.pointsData);
      // console.log('res.dots', res.dots);
      return res.points;
    },
    updateBandsData(data) {
      this.bandsData.map((item, index) => {
        item.x = parseInt(data[index][0]);
        item.y = parseInt(data[index][1]);
        return item;
      });
    },

    convertToPixel(dataItem) {
      return this?.chartDom.convertToPixel('grid', dataItem);
    },
    dragHandle: _.debounce(async (that, data) => {
      const linesData = await that.getLinesData(data);
      that?.chartDom.setOption({
        series: [
          {
            id: 'line',
            data: linesData,
          },
        ],
      });
      // that.renderGraphicList();
    }, 100),
    initChart() {
      const that = this;
      this.chartDom = echarts && echarts.init(this.$refs.dom);
      if (!this.chartDom) return;
      const option = {
        animation: false,
        title: [
          {
            left: 'center',
            text: '输入',
            top: 0,
            textStyle: {
              color: '#808080',
              fontSize: 12,
              lineHeight: 10,
            },
          },
          {
            text: '输\n出',
            left: 350,
            top: 185,
            textStyle: {
              color: '#808080',
              fontSize: 12,
              lineHeight: 16,
            },
          },
        ],
        grid: {
          show: true,
          left: 15,
          right: 60,
          top: 50,
          bottom: 20,
          backgroundColor: '#0d0d0d',
          borderColor: 'transparent',
        },
        // 全局坐标轴指示器
        axisPointer: {
          // show: false,
          type: 'line',
          lineStyle: {
            color: 'rgba(0, 219, 203, 1)',
            type: 'solid',
          },
          label: {
            formatter(params) {
              return parseInt(params.value) + '';
            },
          },
        },
        tooltip: {
          show: true,
          // trigger: 'axis',
          axisPointer: {
            type: 'cross',
            crossStyle: {
              color: 'rgba(0, 219, 203, 1)',
              type: 'solid',
            },
          },
          position: function (pos) {
            return [pos[0] - 40, pos[1] - 95];
          },
          formatter(params) {
            const data = params.data || [0, 0];
            const dataIndex = params.dataIndex;
            const wVal =
              (that.bandsData[dataIndex] && that.bandsData[dataIndex].w) ===
              undefined
                ? ''
                : that.bandsData[dataIndex] && that.bandsData[dataIndex].w;
            return (
              'X: ' +
              data[0].toFixed(0) +
              'dB' +
              '<br>Y: ' +
              data[1].toFixed(0) +
              'dB' +
              '<br>W: ' +
              wVal
            );
          },
        },
        xAxis: {
          min: this.drcVal.minX,
          max: this.drcVal.maxX,
          type: 'value',
          position: 'top',
          // inverse: true,
          interval: 10,
          minInterval: 1,
          axisLabel: {
            color: '#ccc',
            formatter(value) {
              return value === 0 ? value + '(db)' : value;
            },
          },
          axisTick: { show: false }, // 不显示坐标轴刻度线
          axisLine: { show: false }, // 不显示坐标轴线
          splitLine: {
            show: true,
            lineStyle: {
              color: ['rgba(255,255,255,0.1)'],
            },
          },
        },
        yAxis: {
          min: this.drcVal.minY,
          max: this.drcVal.maxY,
          // inverse: true,
          position: 'right',
          interval: 10,
          minInterval: 1,
          type: 'value',
          // boundaryGap: [0, '30%'],
          axisLabel: {
            color: '#ccc',
            formatter(value) {
              return value === -100 ? value + '(db)' : value;
            },
          },
          axisLine: {
            show: false,
            lineStyle: {
              // color: ['rgba(255,255,255,0.1)'],
            },
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: ['rgba(255,255,255,0.1)'],
            },
          },
        },
        series: [
          {
            id: 'point',
            type: 'line',
            symbol: 'circle',
            symbolSize: this.symbolSize,
            lineStyle: {
              color: '#1D99FF',
              width: 0,
            },
            itemStyle: {
              // 设置symbol的颜色
              color: 'rgba(255,255,255,0.5)',
            },
            // areaStyle: {},

            label: {
              show: true,
              color: '#ccc',
              fontSize: 12,
              position: 'bottom',
              formatter: (params) => {
                return '' + (params.dataIndex + 1);
              },
            },
            data: this.pointsData,
          },
          {
            id: 'line',
            type: 'line',
            // smooth: true,
            symbolSize: 0,
            lineStyle: {
              color: '#1D99FF',
              width: 1,
            },

            // areaStyle: {},
            areaStyle: {
              origin: 'start',
              color: 'rgba(5, 104, 255, 0.20)',
            },
            data: this.linesData,
          },
        ],
      };
      this.chartDom.setOption(option);
      this.renderGraphicList();
    },
    renderChart() {
      this?.chartDom.setOption({
        tooltip: { show: true },
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
            position: that.chartDom?.convertToPixel('grid', dataItem),
            // 圆点不可见
            invisible: true,
            draggable: true,
            z: 100,
            onclick: function () {
              console.log(dataIndex, that.bandsData.length);
            },
            onmousemove: function () {
              !that.draging &&
                setTimeout(() => {
                  that.showTooltip(dataIndex);
                }, 0);
            },
            onmouseout: function () {
              that.hideTooltip(dataIndex);
            },
            ondrag: function (e) {
              that.draging = true;
              that.mutex = true;
              if (dataIndex >= that.bandsData.length) {
                dataIndex = that.bandsData.length - 1;
              }

              that.activeIndex = dataIndex;
              // 实时获取拖动的点位信息并根据此信息重新画图
              let positions = that.chartDom.convertFromPixel('grid', [
                this.x,
                this.y,
              ]);
              const [x, y] = that.getPointRange(dataIndex, positions);
              const data = _.cloneDeep(that.pointsData);
              const bandsData = _.cloneDeep(that.bandsData);
              bandsData[dataIndex] = Object.assign(bandsData[dataIndex], {
                x,
                y,
              });
              that.bandsData = bandsData;
              data[dataIndex] = [x, y];
              that.pointsData = data;
              that.chartDom.setOption({
                series: [
                  {
                    id: 'point',
                    data: data,
                  },
                ],
              });
              // that.chartDom.setOption({
              //   tooltip: {
              //     show: false,
              //   },
              // });
              that.dragHandle(that, bandsData);
            },
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
    getPointRange(index, positions) {
      let { minX, minY, maxX, maxY } = this.drcVal;
      let [newPosX, newPosY] = positions;
      const len = this.pointsData.length;

      let nextX, nextY, preX, preY;
      if (index + 1 >= len) {
        [nextX, nextY] = [maxX, maxY];
      } else {
        [nextX, nextY] = this.pointsData[index + 1];
      }
      if (index === 0) {
        [preX, preY] = [minX, minY];
      } else {
        [preX, preY] = this.pointsData[index - 1];
      }
      preY = -100;
      nextY = 0;
      // newPosX = newPosX < nextX ? nextX : newPosX;
      // newPosX = newPosX >= preX ? preX : newPosX;
      newPosX = newPosX < preX ? preX : newPosX;
      newPosX = newPosX >= nextX ? nextX : newPosX;
      newPosY = newPosY <= preY ? preY : newPosY;
      newPosY = newPosY >= nextY ? nextY : newPosY;
      if (index === 0) {
        newPosX = -100;
      }
      if (index + 1 === len) {
        newPosX = 0;
      }
      return [parseInt(newPosX), parseInt(newPosY)];
    },
    saveHandle() {
      const { enable, bandsData, mode, at, rt, rms, fs, seg } = this;
      const params = {
        enable: !enable,
        fs,
        seg,
        dots: bandsData.map((item) => [item.x, item.y, item.w]),
        mode,
        at: at / 1000,
        rt: rt / 1000,
        rms: rms / 1000,
      };
      this.$emit('save', this.type, params);
      this.closeHandle();
    },
    changeBandNums() {
      const { bands } = this.getBandsData(this.seg);
      this.mutex = false;
      this.bandsData = _.cloneDeep(bands);
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
      // this.$emit('reset', this.type);
      this.$emit('reset', this.type);
      this.mutex = false;
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
    activeHandle(key, isActive) {
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
.drc-dialog {
  :deep(.el-dialog__body) {
    padding: 14px 16px !important;
  }
  .flex {
    justify-content: space-around;
  }
  .container {
    align-items: start;
    justify-content: space-between;
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
    width: 380px;
    max-width: 380px;
    height: 380px;
  }
  .output {
    position: absolute;
    display: block;
    font-size: 12px;
    width: 20px;
    height: 32px;
    color: #808080;
  }
  .band-list {
    flex-shrink: 0;
    margin-top: 26px;
    color: #cccccc;
    width: 332px;
    flex-direction: column;
    align-items: start;
    .menu-bar {
      margin-bottom: 16px;
      padding: 0 4px;

      .el-radio {
        margin-right: 16px;
      }
      :deep(.el-radio__label) {
        font-size: 13px;
      }
    }
    .labels {
      min-width: 56px;
      height: 100%;
      margin-right: 8px;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      p {
        height: 16px;
      }
    }
    .band-con {
      // height: 160px;
      flex-direction: column;
      justify-content: space-between;
      // align-items: flex-start;
      &.other {
        margin-top: 32px;
        flex-direction: row;
        flex-wrap: wrap;
      }
      .band {
        height: 36px;
        padding: 0 4px;
        &:hover,
        &.active {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        &:last-child {
          margin-bottom: 0px;
        }
        span {
          font-size: 13px;
          height: 18px;
          margin-left: 8px;
          margin-right: 4px;
          &:nth-child(1) {
            margin-left: 0;
          }
          &:last-child {
            margin-right: 0;
          }
        }
      }
      .list {
        display: flex;
        width: 162px;
        margin-bottom: 14px;
        align-items: center;
        span {
          margin-right: 4px;
        }
        i {
          margin-left: 4px;
          width: 19px;
          height: 18px;
          font-size: 13px;
          color: #808080;
          line-height: 18px;
          font-style: normal;
        }
      }
    }
    .el-input-number--small,
    .el-select--small {
      width: 72px;
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
