import { pathExists, readJSON, writeJson } from 'fs-extra';
import { join, sep } from 'path';
import { dialog } from "electron";
export const ProjectHandle = {
    async createProject(option) {
        try {
            console.log(option);
            let { pathStr, name, configJson, isSave } = option;
            if (!await pathExists(pathStr)) { return { code: -1, msg: `${pathStr}目录不存在` }; }
            const projectPath = join(pathStr, `${name}.lsaudio`);
            console.log(projectPath);
            if (await pathExists(projectPath) && !isSave) {
                const choice = dialog.showMessageBoxSync({
                    type: "info",
                    buttons: ["确认", "取消"],
                    title: "另存为？",
                    message: `【${projectPath}】项目已存在,是否替换现有文件？`,
                    defaultId: 0,
                    cancelId: 1
                });
                if (choice === 1) return { code: -2, msg: `` };

            }
            // await mkdirs(projectPath);
            // const configFile = join(projectPath, 'config.json');
            const manifestJson = { name, version: 1, id: Date.now(), path: projectPath };
            const newConfigJson = configJson || {};
            const projectJson = { manifestJson, configJson: newConfigJson };
            await writeJson(projectPath, projectJson);
            return { code: 0, data: { manifestJson, configJson: newConfigJson } };

        } catch (error) {
            console.log(error);
            return { code: -1, msg: `保存失败，请重试` };
        }

    },
    async saveProject(option) {
        try {
            let { manifestJson, configJson } = option;
            const { path: pathStr
            } = manifestJson;
            if (!await pathExists(pathStr)) { return { code: -1, msg: "项目不存在" }; }
            manifestJson.version = manifestJson.version + 1;
            manifestJson.id = Date.now();
            await writeJson(pathStr, { manifestJson, configJson });
            return { code: 0, data: { manifestJson, configJson } };
        } catch (error) {
            console.log(error);
            return { code: -1, msg: `保存失败，请重试` };

        }

    },
    async checkProject(pathStr) {
        try {
            if (!await pathExists(pathStr)) { return { code: -1, msg: "项目不存在" }; }
            const { configJson, manifestJson } = await readJSON(pathStr);
            const pathArr = pathStr.split(sep);
            manifestJson.name = pathArr[pathArr.length - 1] && pathArr[pathArr.length - 1].split('.lsaudio')[0];
            manifestJson.path = pathStr;
            await writeJson(pathStr, { manifestJson, configJson });
            return { code: 0, data: { configJson, manifestJson } };
        } catch (error) {
            console.log(error);
            return { code: -1, msg: `打开项目失败，请重试` };

        }
    }
};