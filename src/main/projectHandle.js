import { pathExists, readJSON, writeJson, mkdirs } from 'fs-extra';
import { join } from 'path';
export const ProjectHandle = {
    async createProject(option) {
        try {
            console.log(option);
            let { pathStr, name, configJson } = option;
            if (!await pathExists(pathStr)) { return { code: -1, msg: `${pathStr}目录不存在` }; }
            const projectPath = join(pathStr, name);
            console.log(projectPath);
            if (await pathExists(projectPath)) {
                return { code: -1, msg: `【${projectPath}】项目已存在` };
            }
            await mkdirs(projectPath);
            const manifestFile = join(projectPath, 'manifest.json');
            const configFile = join(projectPath, 'config.json');
            const manifestJson = { name, version: 1, id: Date.now(), path: projectPath };
            const newConfigJson = configJson || {};
            await writeJson(manifestFile, manifestJson);
            await writeJson(configFile, newConfigJson);
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
            const manifestFile = join(pathStr, 'manifest.json');
            const configFile = join(pathStr, 'config.json');
            manifestJson.version = manifestJson.version + 1;
            manifestJson.id = Date.now();
            await writeJson(manifestFile, manifestJson);
            await writeJson(configFile, configJson);
            return { code: 0, data: { manifestJson, configJson } };
        } catch (error) {
            console.log(error);
            return { code: -1, msg: `保存失败，请重试` };

        }

    },
    async checkProject(pathStr) {
        try {
            if (!await pathExists(pathStr)) { return { code: -1, msg: "项目不存在" }; }
            const manifestFile = join(pathStr, 'manifest.json');
            const configFile = join(pathStr, 'config.json');
            const hasManifestFile = await pathExists(manifestFile);
            const hasConfigFile = await pathExists(configFile);
            if (hasConfigFile && hasManifestFile) {
                const configJson = await readJSON(configFile);
                const manifestJson = await readJSON(manifestFile);
                return { code: 0, data: { configJson, manifestJson } };
            } else {
                return { code: -1, msg: `该项目缺少配置文件` };
            }
        } catch (error) {
            console.log(error);
            return { code: -1, msg: `打开项目失败，请重试` };

        }
    }
};