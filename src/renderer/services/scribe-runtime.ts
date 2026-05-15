import { inject, type InjectionKey } from 'vue'

export type ScribeInput = string | File

export type ScribeExtractTextPayload = {
	images: ScribeInput[] | FileList;
	langs?: string[];
	outputFormat?: string;
	options?: Record<string, unknown>;
}

export type ScribeExtractTextRequest = {
	id: number;
	type: 'extract-text';
	payload: ScribeExtractTextPayload;
}

export type ScribeCancelRequest = {
	id: number;
	type: 'cancel';
	targetRequestId?: number;
}

export type ScribeRuntimeRequest = ScribeExtractTextRequest | ScribeCancelRequest

export type ScribeRuntimeResponse =
	| {
		id: number;
		type: 'extract-text';
		ok: true;
		data: string | ArrayBuffer;
	}
	| {
		id: number;
		type: 'extract-text';
		ok: false;
		error: unknown;
	}

export type ScribeRuntimeCallback = (response: ScribeRuntimeResponse) => void

export type ScribeRuntimeBridge = {
	extractText(payload: ScribeExtractTextPayload, callback: ScribeRuntimeCallback): number;
	cancel(targetRequestId?: number): number;
}

export const scribeRuntimeBridgeKey: InjectionKey<ScribeRuntimeBridge> = Symbol('scribe-runtime-bridge')

export function useScribeRuntime() {
	const bridge = inject(scribeRuntimeBridgeKey)
	if (!bridge) {
		throw new Error('Scribe runtime bridge is not available.')
	}

	return bridge
}