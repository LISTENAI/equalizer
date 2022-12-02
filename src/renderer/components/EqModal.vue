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
            item.chose ? '' : 'disabled',
          ]"
          @mouseover="() => activeHandle(item.chose, key, true)"
          @mouseleave="() => activeHandle(item.chose, key, false)"
        >
          <el-checkbox
            :label="`频段${key + 1}`"
            v-model="item.chose"
            @change="(v) => changeChose(v, key)"
          ></el-checkbox>
          <el-input-number
            v-model="item.fc"
            controls-position="right"
            :min="20"
            :max="20000"
            size="mini"
            :disabled="!item.chose"
          ></el-input-number>
          <el-input-number
            v-model="item.gain"
            controls-position="right"
            :min="-20"
            :max="20"
            :precision="1"
            :step="0.1"
            size="mini"
            :disabled="!item.chose"
          ></el-input-number>
          <el-input-number
            v-model="item.q"
            controls-position="right"
            :min="0"
            :max="1"
            :precision="1"
            :step="0.1"
            size="mini"
            :disabled="!item.chose"
          ></el-input-number>
          <el-select
            v-model="item.type"
            size="mini"
            :ref="'select' + key"
            @change="changeType($event, key)"
            popper-class="type-select"
            :disabled="!item.chose"
          >
            <el-option
              v-for="type in types"
              :label="type.val"
              :value="type.val"
              :key="type.val"
            >
              <p class="type-label">
                <span>{{ type.val }}</span>
                <img v-bind:src="type.imgUrl" class="type-img" />
              </p>
            </el-option>
          </el-select>
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
      type: 'eq',
      symbolSize: 9, // 通过拖动是可以实时改变这里的值的
      boundaryVal: {
        maxdB: 20,
        mindB: -20,
        maxFC: 20000,
        minFC: 20,
      },
      chartDatas: [
        [20, 0],
        [100, 10],
        [200, 5],
        [300, -12],
        [400, -6],
        [500, 20],
        [600, -5],
        [1000, 6],
        [1800, 20],
        [20000, -0],
      ],
      types: [
        {
          val: 'Peaking',
          label: 'Peaking',
          imgUrl: 'static/imgs/eq_Peaking.png',
        },
        {
          val: 'HighPass',
          label: 'High Pass',
          imgUrl: 'static/imgs/eq_HighPass.png',
        },
        {
          val: 'HighShelf',
          label: 'High Shelf',
          imgUrl: 'static/imgs/eq_HighShelf.png',
        },
        {
          val: 'LowPass',
          label: 'Low Pass',
          imgUrl: 'static/imgs/eq_LowPass.png',
        },
        {
          val: 'lowShelf',
          label: 'low Shelf',
          imgUrl: 'static/imgs/eq_lowShelf.png',
        },
      ],
      bandsData: this.eqData,
      show: this.visible,
      detail: {},
      chartDom: null,
      mutex: false, // 属性监听互斥锁
    };
  },
  watch: {
    eqData: {
      handler(newVal) {
        this.bandsData = this.getBandsData(newVal);
        this.chartDatas = this.getChartData(newVal);
        setTimeout(this.renderChart, 0);
      },
      deep: true,
    },
    visible: function (newVal) {
      this.show = newVal;
    },
  },
  mounted() {
    this.bandsData = this.getBandsData(this.eqData);
    setTimeout(this.renderChart, 0);
    setTimeout(this.resetTypeSelect, 0);
  },
  beforeDestroy() {
    // off(window, 'resize', this.resize);
  },
  methods: {
    getBandsData(data) {
      return data.map((item) => {
        item.chose = item.chose === undefined ? true : item.chose;
        return item;
      });
    },
    getChartData(data) {
      const arr = data.map((item) => {
        return [item.fc, item.gain];
      });
      return arr;
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
      console.log(this.chartDatas);
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
              return this.bandsData[params.dataIndex].chose
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
            data: this.chartDatas,
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
            data: this.chartDatas,
          },
        ],
      };
      this.chartDom.setOption(option);
      const { minX, maxX, minY, maxY } = this.getBoundaryValGrid();
      // console.log(minX, maxX, minY, maxY);
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
              that.chartDatas[dataIndex] = that.chartDom.convertFromPixel(
                'grid',
                [this.position[0], this.position[1]]
              );
              // console.log(that.chartDatas);
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
      const params = { checkable: this.checkable, data: this.eqData };
      console.log(params, this.eqData);
      // this.eqData.item &&
      //   this.eqData.item.map((item) => {
      //     params[item.type] = item.value;
      //   });
      this.$emit('save', this.type, params);
    },
    closeHandle() {
      this.resetHandle();
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
      console.log(item);
      const typeObj = this.types.find((type) => item.type === type.val);
      const opacity = item.chose ? 1 : 0.5;
      this.$refs['select' + key][0].$el.children[0].children[0].setAttribute(
        'style',
        'background-image:url(' +
          typeObj.imgUrl +
          ');text-indent: -9999px;background-position: 6px 2px;background-repeat: no-repeat;background-size: 32px 16px;opacity:' +
          opacity +
          ';'
      );
    },
    changeType(e, key) {
      const item = this.types.find((item) => item.val === e);
      this.$refs['select' + key][0].$el.children[0].children[0].setAttribute(
        'style',
        'background-image:url(' +
          item.imgUrl +
          ');text-indent: -9999px;background-position: 6px 2px;background-repeat: no-repeat;background-size: 32px 16px;'
      );
    },
    changeChose(v, key) {
      console.log(v, key);
      const item = this.bandsData[key];
      item.chose = v;
      this.$set(this.bandsData, key, item);
      this.changeTypeImg(key, item);
      this.renderChart();
    },
    showTooltip(key) {
      if (!key) {
        return;
      }
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
      this.chartDom.dispatchAction({
        type: 'hideTip',
        seriesIndex: 0,
        dataIndex: key,
      });
    },
    activeHandle(chose, key, isActive) {
      if (!chose) {
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
