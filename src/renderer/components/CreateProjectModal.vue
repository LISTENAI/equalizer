<template>
  <el-dialog
    title="项目配置"
    :visible="show"
    width="500px"
    class="project-dialog"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    @close="closeHandle"
  >
    <div class="container">
      <el-form
        :inline="true"
        ref="project-form"
        :model="formData"
        class="demo-form-inline"
        :rules="rules"
      >
        <el-form-item label="项目地址" prop="pathStr">
          <el-input
            size="middle"
            style="width: 200px"
            v-model="formData.pathStr"
            placeholder="项目地址"
          ></el-input>
          <el-button
            size="middle"
            style="margin-left: 20px"
            @click.prevent="selsectDict"
            >选择</el-button
          >
        </el-form-item>
        <el-form-item label="项目名称" prop="name">
          <el-input
            style="width: 200px"
            size="middle"
            v-model="formData.name"
            placeholder="项目名称"
          ></el-input>
        </el-form-item>
      </el-form>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button type="primary" @click="saveHandle">确 定</el-button>
      <el-button @click="() => (show = false)">取 消</el-button>
    </span>
  </el-dialog>
</template>
<script>
export default {
  name: 'ProjectModal',
  props: {
    visible: {
      type: Boolean,
      default: () => {
        return {};
      },
    },
    close: {
      type: Function,
    },
    save: {
      type: Function,
    },
  },

  data() {
    return {
      formData: {
        pathStr: '',
        name: '',
      },
      rules: {
        name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
        pathStr: [
          { required: true, message: '请选择项目地址', trigger: 'blur' },
        ],
      },
      show: this.visible,
    };
  },
  watch: {
    visible: function (newVal) {
      this.show = newVal;
    },
  },
  mounted() {},
  methods: {
    async selsectDict() {
      const res = await this.$electron.ipcRenderer.invoke('open-dict');
      if (res) this.formData.pathStr = res;
    },
    saveHandle() {
      this.$refs['project-form'].validate((valid) => {
        if (valid) {
          console.log(this.formData);
          this.$emit('save', this.formData);
          this.closeHandle();
        } else {
          console.log('error submit!!');
          return false;
        }
      });
    },
    closeHandle() {
      this.$refs['project-form'].resetFields();
      this.$emit('close');
    },
  },
};
</script>
<style lang="scss" scoped>
.project-dialog {
  .el-form-item {
    margin-bottom: 10px;
  }

  .dialog-footer {
    .el-button {
      padding: 7px 25.5px;
      margin-right: 0;
    }
  }
}
</style>
