// import ScreenShot from "js-web-screen-shot";
// import { ScreenShotOptions } from "js-web-screen-shot/dist/lib/type/components/screenshot";

// export function getInitStream(source: any): Promise<MediaStream | null> {
//     return new Promise((resolve, _reject) => {
//         // 获取指定窗口的媒体流
//         // 此处遵循的是webRTC的接口类型  暂时TS类型没有支持  只能断言成any
//         (navigator.mediaDevices as any).getUserMedia({
//             audio: false,
//             video: {
//                 mandatory: {
//                     chromeMediaSource: 'desktop',
//                     chromeMediaSourceId: source.id
//                 },
//             }
//         }).then((stream: MediaStream) => {
//             resolve(stream);
//         }).catch((error: any) => {
//             console.log(error);
//             resolve(null);
//         });
//     });
// }

// export async function custom_screenshot(options?: ScreenShotOptions) {
//     const sources = await window.electronAPI.getDesktopCapturerSource();
//     const stream = await getInitStream(sources[0]);

//     return new ScreenShot({
//         menuBarHeight: 22,
//         capture: {
//             source: "injected-stream",
//             stream: stream!
//         },
//         level: 999,
//         ...options
//     });
// }