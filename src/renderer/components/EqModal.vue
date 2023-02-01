<template>
  <el-dialog
    title="EQ均衡器"
    :visible="show"
    width="880px"
    class="eq-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="closeHandle"
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
            :min="20"
            :max="20000"
            size="mini"
            :disabled="!item.enable"
          ></el-input-number>
          <el-input-number
            v-model="item.gain"
            controls-position="right"
            :min="-18"
            :max="18"
            :precision="1"
            :step="0.1"
            size="mini"
            :disabled="!item.enable"
          ></el-input-number>
          <el-input-number
            v-model="item.q"
            controls-position="right"
            :min="0.3"
            :max="10.0"
            :precision="1"
            :step="0.1"
            size="mini"
            :disabled="!item.enable"
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
      <el-button @click="closeHandle">取消</el-button>
    </span>
  </el-dialog>
</template>

<script>
import * as echarts from 'echarts';
import _ from 'lodash';

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
      symbolSize: 9, // 通过拖动是可以实时改变这里的值的
      boundaryVal: {
        maxdB: 18,
        mindB: -18,
        maxFC: 20000,
        minFC: 20,
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
    };
  },
  watch: {
    eqData: {
      handler(val) {
        const newVal = JSON.parse(JSON.stringify(val));
        this.parseEqData(newVal);
      },
      deep: true,
    },
    bandsData: {
      handler(val) {
        const that = this;
        this.updateBandsData(that, val);
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
  mounted() {
    this.parseEqData(JSON.parse(JSON.stringify(this.eqData)));
  },
  beforeDestroy() {
    // off(window, 'resize', this.resize);
  },
  methods: {
    updateBandsData: _.debounce((that, val) => {
      console.log('bandsData更新', val);
      const newVal = JSON.parse(JSON.stringify(val));
      that.pointsData = that.getPointsData(newVal);
      that.linesData = that.getLinesData(newVal);
      setTimeout(that.renderChart, 0);
      setTimeout(that.resetTypeSelect, 0);
    }, 400),

    parseEqData(data) {
      const filters = data.map((item) => {
        const [enable, type, dSampleRateHz, q, gain, fc] = item;
        return {
          enable: !!enable,
          type,
          dSampleRateHz: dSampleRateHz || 48000,
          q,
          gain,
          fc,
        };
      });
      this.bandsData = this.getBandsData(filters);
      this.pointsData = this.getPointsData(filters);
      this.linesData = this.getLinesData(filters);
      setTimeout(this.renderChart, 0);
      setTimeout(this.resetTypeSelect, 0);
    },
    getBandsData(data) {
      return data.map((item) => {
        item.enable = item.enable === undefined ? true : !!item.enable;
        return item;
      });
    },
    getPointsData(data) {
      const arr = data.map((item) => {
        return [item.fc, item.gain];
      });
      console.log('获取point', arr);

      return arr;
    },
    getLinesData(data) {
      const arr = JSON.parse(JSON.stringify(this.pointsData));
      arr.map((item) => {
        item[0] = item[0] * 3;
        item[1] = item[1] + 2;
        return item;
      });
      console.log('获取line', arr);
      return arr;
      //调用算法拿到line的数据
    },
    getBoundaryValGrid() {
      const { maxdB, mindB, maxFC, minFC } = this.boundaryVal;
      const maxArr = this.convertToPixel([maxFC, maxdB]);
      const minArr = this.convertToPixel([minFC, mindB]);
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
      const that = this;
      this.chartDom = echarts && echarts.init(this.$refs.dom);
      if (!this.chartDom) return;
      const option = {
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
            // console.log(params.dataIndex);
            return (
              '频率: ' +
              data[0].toFixed(0) +
              'Hz' +
              '<br>增益: ' +
              data[1].toFixed(0) +
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
          min: this.boundaryVal.mindB,
          max: this.boundaryVal.maxdB,
          interval: 4,
          minInterval: 1,
          type: 'value',
          // boundaryGap: [0, '30%'],
          axisLabel: {
            color: '#ccc',
            formatter(value) {
              return value + ' dB';
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
          },
        ],
      };
      this.chartDom.setOption(option);
      const { minX, maxX, minY, maxY } = this.getBoundaryValGrid();
      // console.log(minX, maxX, minY, maxY);
      const graphicList = echarts.util.map(
        this.pointsData,
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
            onmousemove: function () {
              that.showTooltip(dataIndex);
            },
            onmouseout: function () {
              that.hideTooltip(dataIndex);
            },
            ondrag: echarts.util.curry(function (dataIndex) {
              // position:[x,y]坐标 限制边界
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
              let [fc, gain] = that.chartDom.convertFromPixel('grid', [
                this.position[0],
                this.position[1],
              ]);
              fc = parseInt(fc);
              that.$set(
                that.bandsData,
                dataIndex,
                Object.assign(that.bandsData[dataIndex], {
                  fc,
                  gain,
                })
              );
              // const linesData = that.getLinesData(that, that.bandsData);
              that.chartDom.setOption({
                series: [
                  {
                    id: 'point',
                    data: that.pointsData,
                  },
                  {
                    id: 'line',
                    data: that.linesData,
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
      const data = this.bandsData.map((item) => {
        const { enable, type, dSampleRateHz, q, gain, fc } = item;
        return [enable ? 1 : 0, type, dSampleRateHz || 48000, q, gain, fc];
      });
      const params = { enable: !this.enable, filters: data };
      this.$emit('save', this.type, params);
    },
    closeHandle() {
      // this.resetHandle();
      this.$emit('close');
    },
    resetHandle() {
      this.$emit('reset', this.type);
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
        this.$refs['select' + key][0].$el.children[0].children[0].setAttribute(
          'style',
          'background-image:url(' +
            img +
            ');color: transparent;background-position: 6px 2px;background-repeat: no-repeat;background-size: 32px 16px;opacity:' +
            opacity +
            ';'
        );
    },
    changeType(e, key) {
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
      const item = this.bandsData[key];
      item.enable = v;
      this.$set(this.bandsData, key, item);
      this.changeTypeImg(key, item);
      this.renderChart();
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
