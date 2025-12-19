import {
	ElButton,
	ElSelect,
	ElAutocomplete,
	ElOption,
	ElCheckbox,
	ElDialog,
	ElInputNumber,
	ElInput,
	ElSlider,
	ElRadio,
	ElForm,
	ElFormItem,
	ElLoading,
	ElMessageBox,
	ElMessage
} from 'element-plus';

export default {
	install(app) {
		app.use(ElAutocomplete);
		app.use(ElButton);
		app.use(ElSelect);
		app.use(ElOption);
		app.use(ElCheckbox);
		app.use(ElDialog);
		app.use(ElInputNumber);
		app.use(ElInput);
		app.use(ElSlider);
		app.use(ElRadio);
		app.use(ElForm);
		app.use(ElFormItem);

		app.use(ElLoading);
		app.config.globalProperties.$msgbox = ElMessageBox;
		app.config.globalProperties.$alert = ElMessageBox.alert;
		app.config.globalProperties.$confirm = ElMessageBox.confirm;
		app.config.globalProperties.$message = ElMessage;
	}
};