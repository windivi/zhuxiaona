import { inject, type InjectionKey } from 'vue'

export type ScreenshotCaptureRequest = {
	id: number;
	type: 'capture';
}

export type ScreenshotCancelRequest = {
	id: number;
	type: 'cancel';
	targetRequestId?: number;
}

export type ScreenshotRuntimeRequest = ScreenshotCaptureRequest | ScreenshotCancelRequest

export type ScreenshotRuntimeResponse =
	| {
		id: number;
		type: 'capture';
		ok: true;
		data: string;
	}
	| {
		id: number;
		type: 'capture';
		ok: false;
		error: unknown;
	}

export type ScreenshotRuntimeCallback = (response: ScreenshotRuntimeResponse) => void

export type ScreenshotRuntimeBridge = {
	capture(callback: ScreenshotRuntimeCallback): number;
	cancel(targetRequestId?: number): number;
}

export const screenshotRuntimeBridgeKey: InjectionKey<ScreenshotRuntimeBridge> = Symbol('screenshot-runtime-bridge')

export function useScreenshotRuntime() {
	const bridge = inject(screenshotRuntimeBridgeKey)
	if (!bridge) {
		throw new Error('Screenshot runtime bridge is not available.')
	}

	return bridge
}