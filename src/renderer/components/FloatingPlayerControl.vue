<template>
  <div class="floating-player-control">
    <div class="title-container">
      <el-tooltip :content="description" placement="top" raw-content>
        <img :src="HelpIcon" class="help-icon" />
      </el-tooltip>
      <span class="title">参数试听</span>
      <span class="file-name" :title="fileTooltip">
        {{ displayName || '未选择文件' }}
      </span>
    </div>
    <div class="control-group">
      <el-button
        size="small"
        :disabled="selecting || starting || isPlaying"
        @click="handlePlay"
        >选择文件
        <template #icon
          ><img class="btn-icon" :src="AudioFileIcon" alt="选择文件"
        /></template>
      </el-button>
      <el-button
        size="small"
        :disabled="stopping || (!isPlaying && !starting)"
        @click="handleStop"
        >停止
        <template #icon
          ><img class="btn-icon" :src="StopCircleIcon" alt="停止"
        /></template>
      </el-button>
      <el-button
        size="small"
        :disabled="!lastFilePath || starting || isPlaying"
        @click="handleReplay"
        >重播
        <template #icon
          ><img class="btn-icon" :src="ReplayIcon" alt="重播"
        /></template>
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import AudioFileIcon from '../assets/svg/audio_file.svg';
import StopCircleIcon from '../assets/svg/stop_circle.svg';
import ReplayIcon from '../assets/svg/replay.svg';
import HelpIcon from '../assets/svg/help.svg';

const props = defineProps({
  audioParams: {
    type: Object,
    required: false,
    default: null,
  },
});

const selecting = ref(false);
const stopping = ref(false);
const starting = ref(false);
let playbackRequest = 0;
const isPlaying = ref(false);
const lastFilePath = ref('');
const description = ref(
  '选择本地音频试听当前均衡器参数<br/>' +
  '播放过程中修改均衡器参数可以实时生效'
);

const audioFilters = [
  {
    name: 'Audio',
    extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'pcm'],
  },
];

const handlePlay = async () => {
  if (selecting.value) return;
  const request = ++playbackRequest;
  selecting.value = true;
  try {
    if (!props.audioParams) {
      throw new Error('缺少音频参数');
    }
    const res = await window.ipcRenderer.invoke('open-file', {
      filters: audioFilters,
      properties: ['openFile'],
    });
    const filePath = res?.data?.[0];
    if (!filePath) return;
    starting.value = true;
    lastFilePath.value = filePath;
    const parameterResult = await window.ipcRenderer.invoke(
      'player-set-params',
      JSON.stringify(props.audioParams),
    );
    if (request !== playbackRequest) return;
    if (parameterResult.code !== 0) throw new Error(parameterResult.message || '音频参数设置失败');
    const { code, message } = await window.ipcRenderer.invoke('player-play', {
      file: filePath,
    });
    if (code !== 0 && request === playbackRequest) {
      throw new Error(message || '播放失败');
    }
  } catch (error) {
    console.error(error);
    if (request === playbackRequest) ElMessage.error(error?.message || '播放失败');
  } finally {
    selecting.value = false;
    if (request === playbackRequest) starting.value = false;
  }
};

const handleStop = async () => {
  if (stopping.value) return;
  const request = ++playbackRequest;
  stopping.value = true;
  try {
    const { code, message } = await window.ipcRenderer.invoke('player-stop');
    if (code !== 0) {
      throw new Error(message || '停止失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error(error?.message || '停止失败');
  } finally {
    stopping.value = false;
    if (request === playbackRequest) starting.value = false;
  }
};

const handleReplay = async () => {
  if (!lastFilePath.value || isPlaying.value) return;
  const request = ++playbackRequest;
  starting.value = true;
  try {
    const parameterResult = await window.ipcRenderer.invoke('player-set-params', JSON.stringify(props.audioParams));
    if (request !== playbackRequest) return;
    if (parameterResult.code !== 0) throw new Error(parameterResult.message || '音频参数设置失败');
    const { code, message } = await window.ipcRenderer.invoke('player-play', {
      file: lastFilePath.value,
      params: props.audioParams,
    });
    if (code !== 0 && request === playbackRequest) {
      throw new Error(message || '播放失败');
    }
  } catch (error) {
    console.error(error);
    if (request === playbackRequest) ElMessage.error(error?.message || '播放失败');
  } finally {
    if (request === playbackRequest) starting.value = false;
  }
};

const onPlayerState = (_e, payload) => {
  isPlaying.value = Boolean(payload?.isPlaying);
  if (payload?.message) ElMessage.error(payload.message);
};
window.ipcRenderer.on('player-state', onPlayerState);
onUnmounted(() => window.ipcRenderer.removeListener('player-state', onPlayerState));

const displayName = computed(() => {
  if (!lastFilePath.value) return '';
  const parts = lastFilePath.value.split(/[/\\\\]/);
  return parts[parts.length - 1] || '';
});
const fileTooltip = computed(() => lastFilePath.value || '未选择文件');
</script>

<style scoped>
.floating-player-control {
  position: fixed;
  right: 12px;
  bottom: 12px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  color: #fff;
  z-index: 2000;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 14px;
  text-align: center;
  font-weight: bold;
}

.file-name {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  margin-right: 4px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.help-icon {
  width: 16px;
  height: 16px;
}

.is-disabled .btn-icon {
  opacity: 0.3;
}
</style>
