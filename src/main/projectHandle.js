import { pathExists, readJSON, writeJson } from 'fs-extra';
import { join } from 'path';
export const ProjectHandle = {
    async createProject(option) {
        try {
            console.log(option);
            let { pathStr, name, configJson } = option;
            if (!await pathExists(pathStr)) { return { code: -1, msg: `${pathStr}目录不存在` }; }
            const projectPath = join(pathStr, `${name}.lsaudio`);
            console.log(projectPath);
            if (await pathExists(projectPath)) {
                return { code: -1, msg: `【${projectPath}】项目已存在` };
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
            return { code: 0, data: { configJson, manifestJson } };
        } catch (error) {
            console.log(error);
            return { code: -1, msg: `打开项目失败，请重试` };

        }
    }
};