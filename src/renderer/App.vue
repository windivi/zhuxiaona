<script setup lang="ts">
import { theme } from 'ant-design-vue';
import Activity from './components/activity.vue'
import MActivity from './components/m-activity.vue';
import ConsolePanel from './components/console-panel.vue'
import TranscodeConfig from './components/transcode-config.vue'
</script>

<template>
	<a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
		<a-tabs class="tab">
			<a-tab-pane key="normal" tab="常用转发">
				<Activity />
			</a-tab-pane>
			<a-tab-pane key="month" tab="月度转发">
				<MActivity></MActivity>
			</a-tab-pane>
			<a-tab-pane key="transcode" tab="转码配置">
				<TranscodeConfig />
			</a-tab-pane>
			<a-tab-pane key="logs" tab="后端日志">
				<ConsolePanel />
			</a-tab-pane>
		</a-tabs>
	</a-config-provider>
</template>

<style scoped>
.size-full {
	width: 100%;
	height: 100%;
}

.tab {
	width: 100%;
	min-height: 100vh;
	padding: 0 20px 20px 20px;
}

:deep(.ant-tabs-content-holder) {
	flex: 1;
	height: 100%;
	width: 100%;
	display: flex;


	.ant-tabs-content {
		flex: 1;
		height: 100%;
		width: 100%;
		display: flex;
	}

	.ant-tabs-tabpane {
		flex: 1;
		height: 100%;
		width: 100%;
		display: flex;
	}
}

:deep(.ant-pagination-options) {
	.ant-select {
		min-width: 100px;
	}
}
</style>
