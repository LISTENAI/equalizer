<template>
  <el-dialog
    title="DRC"
    :visible="show"
    width="750px"
    class="drc-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="closeHandle"
  >
    <div class="container flex">
      <div ref="dom" id="chart" class="charts chart-bar"></div>
      <div class="band-list flex">
        <div class="menu-bar">
          <el-radio
            v-for="item in bandNums"
            :label="item"
            v-model="bandNum"
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
            @mouseenter="() => showToolTip(key)"
          >
            <span>{{ key + 1 }}.</span>
            <span>X</span>
            <el-input-number
              v-model="item.x"
              controls-position="right"
              :min="-100"
              :max="0"
              size="mini"
            ></el-input-number>
            <span>Y</span>
            <el-input-number
              v-model="item.y"
              controls-position="right"
              :min="-100"
              :max="0"
              size="mini"
            ></el-input-number>
            <span>W</span>
            <el-input-number
              v-model="item.w"
              controls-position="right"
              :min="0"
              :max="20"
              size="mini"
            ></el-input-number>
            <span>dB</span>
          </div>
        </div>
        <div class="band-con flex other">
          <div class="list">
            <span>启动时间</span>
            <el-input-number
              v-model="startTime"
              controls-position="right"
              :min="0"
              :max="100"
              size="mini"
            ></el-input-number>
            <i>ms</i>
          </div>
          <div class="list">
            <span>释放时间</span>
            <el-input-number
              v-model="releaseTime"
              controls-position="right"
              :min="0"
              :max="5000"
              size="mini"
            ></el-input-number>
            <i>ms</i>
          </div>
          <div class="list">
            <span>检测类型</span>
            <el-select v-model="drcType" size="mini">
              <el-option
                v-for="type in types"
                :label="type"
                :value="type"
                :key="type"
              >
              </el-option>
            </el-select>
          </div>
          <div class="list" v-if="drcType !== 'Peak'">
            <span>检测时间</span>
            <el-input-number
              v-model="checkTime"
              controls-position="right"
              :min="0.02"
              :max="100"
              :precision="2"
              :step="0.01"
              size="mini"
            ></el-input-number>
            <i>ms</i>
          </div>
        </div>
      </div>
    </div>

    <span slot="footer" class="dialog-footer">
      <div class="fl">
        <el-button @click="resetHandle">重置</el-button>
        <el-checkbox v-model="checkable">Bypass</el-checkbox>
      </div>
      <el-button type="primary" @click="saveHandle">确 定</el-button>
      <el-button @click="closeHandle">取消</el-button>
    </span>
  </el-dialog>
</template>

<script>
import * as echarts from 'echarts';
export default {
  props: {
    drcData: {
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
      activeIndex: null,
      bandNums: [3, 4, 5],
      bandNum: 5,
      type: 'drc',
      symbolSize: 9, // 通过拖动是可以实时改变这里的值的
      drcVal: {
        maxY: 0,
        minY: -100,
        maxX: 0,
        minX: -100,
        defaultW: 3,
      },
      ranges: {},
      chartDatas: [
        [0, 0],
        [-25, -25],
        [-50, -50],
        [-75, -75],
        [-100, -100],
      ],
      types: ['Peak', 'RMS'],
      // bandsData: this.drcData, //后续数据传入
      bandsData: [],
      startTime: 10,
      releaseTime: 500,
      checkTime: 0.02,
      drcType: 'Peak',
      show: this.visible,
      chartDom: null,
      mutex: false, // 属性监听互斥锁
    };
  },
  watch: {
    // bands改变 更新 chart  chart改变band，但是band不需要再
    bandsData: {
      handler(newVal) {
        if (!this.mutex) {
          console.log('更新bandsdata', newVal);
          this.bandsData = newVal;
          this.chartDatas = this.getChartData(newVal);
          setTimeout(this.renderChart, 0);
        }
      },
      deep: true,
    },
    visible: function (newVal) {
      this.show = newVal;
    },
    bandNum: function (newVal) {
      const { charts, bands } = this.getBandsData(newVal);
      this.chartDatas = charts;
      this.bandsData = bands;
      setTimeout(this.renderChart, 0);
    },
  },

  mounted() {
    const { charts, bands } = this.getBandsData(this.bandNum);
    this.chartDatas = charts;
    this.bandsData = bands;
    // setTimeout(this.renderChart, 0);
  },
  beforeDestroy() {
    // off(window, 'resize', this.resize);
  },
  methods: {
    getBandsData(num) {
      const { minX, minY, maxX, maxY, defaultW } = this.drcVal;
      console.log(defaultW);
      const Xrange = -parseInt((maxX - minX) / (num - 1));
      const Yrange = -parseInt((maxY - minY) / (num - 1));
      const bandArr = [];
      const chartArr = [];
      for (let i = 0; i < num; i++) {
        bandArr.push({
          x: Xrange * i,
          y: Yrange * i,
          w: defaultW,
        });
        chartArr.push([Xrange * i, Yrange * i]);
      }
      return { charts: chartArr, bands: bandArr };
    },
    getChartData(data) {
      const arr = data.map((item) => {
        return [item.x, item.y];
      });
      return arr;
    },
    updateBandsData(data) {
      this.bandsData.map((item, index) => {
        item.x = parseInt(data[index][0]);
        item.y = parseInt(data[index][1]);
        return item;
      });
    },
    getBoundaryValGrid(n) {
      const num = n || this.bandNum;
      const { maxY, minY, maxX, minX } = this.drcVal;
      const maxYStep = maxY / num;
      const minYStep = minY / num;
      const maxXStep = maxX / num;
      const minXStep = minX / num;
      const maxArr = this.convertToPixel([maxXStep, maxYStep]);
      const minArr = this.convertToPixel([minXStep, minYStep]);

      console.log({
        maxX: maxArr[0],
        minX: minArr[0],
        maxY: maxArr[1],
        minY: minArr[1],
      });
      return {
        maxX: maxArr[0],
        minX: minArr[0],
        maxY: maxArr[1],
        minY: minArr[1],
      };
    },
    convertToPixel(dataItem) {
      return this.chartDom && this.chartDom.convertToPixel('grid', dataItem);
    },
    renderChart() {
      console.log(this.chartDatas);
      const that = this;
      this.chartDom = echarts && echarts.init(this.$refs.dom);
      if (!this.chartDom) return;
      const option = {
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
          trigger: 'axis', // 设置成坐标轴触发之后，设置crossStyle只有x轴的线生效
          axisPointer: {
            type: 'cross',
            crossStyle: {
              color: 'rgba(0, 219, 203, 1)',
              type: 'solid',
            },
          },
          position: function (pos, params, dom, rect, size) {
            return [pos[0] - 40, pos[1] - 95];
          },
          formatter(params) {
            const data = params[0].data || [0, 0];
            const dataIndex = params[0].dataIndex;
            const wVal = that.bandsData[dataIndex].w;
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
            // smooth: true,
            symbol: 'circle',
            symbolSize: this.symbolSize,
            lineStyle: {
              color: '#1D99FF',
              width: 1,
            },
            itemStyle: {
              // 设置symbol的颜色
              color: 'rgba(255,255,255,0.5)',
            },
            // areaStyle: {},
            areaStyle: {
              origin: 'start',
              color: 'rgba(5,104,255,0.2)',
            },
            label: {
              show: true,
              color: '#ccc',
              fontSize: 12,
              position: 'bottom',
              formatter: (params) => {
                return '' + params.dataIndex;
              },
            },
            data: this.chartDatas,
          },
        ],
      };
      this.chartDom.setOption(option);
      const { minX, maxX, minY, maxY } = this.getBoundaryValGrid(1);
      console.log(minX, maxX, minY, maxY);
      const graphicList = echarts.util.map(
        this.chartDatas,
        (dataItem, dataIndex) => {
          const that = this;
          return {
            type: 'circle',
            shape: {
              r: that.symbolSize,
            },
            // style: {
            //   fill: '#fff',
            //   stroke: '#fff',
            //   lineWidth: 0,
            // },
            // 用 transform 的方式对圆点进行定位。position: [x, y] 表示将圆点平移到 [x, y] 位置。
            // convertToPixel获取每个圆点的位置
            position: that.chartDom.convertToPixel('grid', dataItem),
            // 圆点不可见
            invisible: true,
            draggable: true,
            z: 100,
            onmousemove: () => {
              setTimeout(() => {
                that.chartDom.dispatchAction({
                  type: 'showTip', // 根据 tooltip 的配置项显示提示框。
                  seriesIndex: 0,
                  dataIndex,
                });
              }, 0);
            },
            ondrag: echarts.util.curry(function (dataIndex) {
              // 这里要改 具体每个点可拖动范围等确定
              // position:[x,y]坐标 限制边界
              // console.log(
              //   dataIndex - 1,
              //   that.chartDom.convertToPixel(
              //     'grid',
              //     that.chartDatas[dataIndex - 1]
              //   )
              // );
              that.activeIndex = dataIndex;
              if (this.position[0] > maxX) {
                this.position[0] = maxX;
              } else if (this.position[0] < minX) {
                this.position[0] = minX;
              }
              if (this.position[1] > minY) {
                this.position[1] = minY;
              } else if (this.position[1] < maxY) {
                this.position[1] = maxY;
              }
              // 实时获取拖动的点位信息并根据此信息重新画图
              const [newPosX, newPosY] = that.chartDom.convertFromPixel(
                'grid',
                [parseInt(this.position[0]), parseInt(this.position[1])]
              );
              // newPosY 加了parseInt之后，不能约束边界。。。
              that.chartDatas[dataIndex] = [parseInt(newPosX), newPosY];
              that.updateBandsData(that.chartDatas);
              that.mutex = true;
              that.chartDom.setOption({
                series: [
                  {
                    id: 'point',
                    data: that.chartDatas,
                  },
                ],
              });
            }, dataIndex),
          };
        }
      );
      // console.log(graphicList);
      this.chartDom.setOption({
        graphic: graphicList,
      });
    },
    resize() {
      // this.dom.resize();
    },
    saveHandle() {
      this.closeHandle();
      const {
        checkable,
        bandsData,
        drcType,
        startTime,
        releaseTime,
        checkTime,
      } = this;
      const params = {
        checkable,
        data: bandsData,
        drcType,
        startTime,
        releaseTime,
        checkTime,
      };
      this.$emit('save', this.type, params);
    },
    closeHandle() {
      this.resetHandle();
      this.$emit('close');
    },
    resetHandle() {
      // this.$emit('reset', this.type);
      this.bandNum = 5;
      this.startTime = 10;
      this.releaseTime = 500;
      this.checkTime = 0.02;
      this.drcType = 'Peak';
      const { charts, bands } = this.getBandsData(this.bandNum);
      this.chartDatas = charts;
      this.bandsData = bands;
      this.mutex = false;
    },
    showToolTip(key) {
      this.chartDom.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: key,
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.drc-dialog {
  /deep/.el-dialog__body {
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
      /deep/.el-radio__label {
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
    .el-input-number--mini,
    .el-select--mini {
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
