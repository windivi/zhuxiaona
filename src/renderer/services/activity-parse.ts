
import * as cheerio from 'cheerio';
import { ActivityItem, ActivityDetailItem, PlatformItem, ReviewItem, ScriptOptions, ParsedImage, ParsedMedia } from '.';
import { parseScriptOptionsFromHtml } from './m-activity-parse';
export function extractTokenFromLoginHtml(html: string): string {
	const jsMatch = html.match(/Dcat\.token\s*=\s*["']([^"']+)["']/);
	if (jsMatch) return jsMatch[1];
	const match = html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/);
	if (match) return match[1];
	return '';
}

export function parseActivityListFromHtml(html: string) {
	const $ = cheerio.load(html || '');
	const activities: ActivityItem[] = [];
	const details: ActivityDetailItem[] = [];
	const platforms: PlatformItem[] = [];
	const scriptOptions: ScriptOptions[] = parseScriptOptionsFromHtml(html);
	// 活动
	$('select.activity_id option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) activities.push({ id, title });
	});

	// 明细活动
	$('select.item_id option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) details.push({ id, title });
	});

	// 平台
	$('select.route_id option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) platforms.push({ id, title });
	});

	return { activities, details, platforms, scriptOptions };
}

export function parseReviewListFromHtml(html: string): { list: ReviewItem[]; total: number } {
	const $ = cheerio.load(html || '');
	const rows = $('#grid-table tbody tr');
	const out: ReviewItem[] = [];

	rows.each((_, tr) => {
		const tds = $(tr).find('td');
		if (tds.length < 14) return;

		const getText = (i: number) => $(tds[i]).text().replace(/\u00a0/g, ' ').trim();
		const getHtml = (i: number) => $(tds[i]).html() || '';

		const item: ReviewItem = {
			id: getText(0),
			activityTitle: getText(1),
			itemTitle: getText(2),
			platformName: getText(3),
			groupName: getText(4),
			nickname: getText(5),
			uid: getText(6),
			phone: getText(7),
			logDetailHtml: getHtml(8),
			uploadTime: getText(9),
			votes: getText(10),
			auditor: getText(11),
			auditTime: getText(12),
			auditActionHtml: getHtml(13),
			auditResult: getText(14),
			images: [],
			medias: [],
		};

		// collect modal ids
		const collectModalIds = (htmlStr: string) => {
			const ids: string[] = [];
			if (!htmlStr) return ids;
			const m = htmlStr.match(/data-target=\s*["']#([^"']+)["']/gi);
			if (!m) return ids;
			m.forEach(s => {
				const id = (s.match(/data-target=\s*["']#([^"']+)["']/i) || [])[1];
				if (id) ids.push(id);
			});
			return ids;
		}

		const modalIds = [...collectModalIds(item.logDetailHtml || ''), ...collectModalIds(item.auditActionHtml)];
		// derive audit status from the row's auditResult text (column 14)
		const rowAuditText = (item.auditResult || '').trim();
		let rowAuditStatus: 0 | 1 | 2 = 0;
		if (rowAuditText.indexOf('未审核') !== -1) rowAuditStatus = 1;
		else if (rowAuditText.indexOf('未通过') !== -1 || rowAuditText.indexOf('审核未通过') !== -1) rowAuditStatus = 2;
		else rowAuditStatus = 0; // 审核通过 或 其他 映射为 0
		const seen = new Set<string>();
		modalIds.forEach(id => {
			const modal = $(`#${id}`);
			if (!modal || modal.length === 0) return;
			// 解析 modal 内的 itemTitle / audit status / script id（尽量从 modal 中提取）
			let itemTitle = '';
			const titleTd = modal.find('td[width="180"]').first();
			if (titleTd.length) {
				itemTitle = titleTd.text().replace(/\s+/g, ' ').trim();
			} else {
				// 备选：尝试寻找表格首列或标题
				const th = modal.find('th').first();
				if (th.length) itemTitle = th.text().trim();
			}

			// audit status: use the status derived from the table row (not modal select)
			const auditStatus = rowAuditStatus;
			const auditStatusName = rowAuditText;

			// script id: 优先使用与上传 id 关联的 select（class 包含 script_id{uploadId}）
			// 备选：任意含 script_id 的 select；最终将空字符串规范为 undefined
			let scriptId: string | undefined = undefined;

			// 尝试从 modal 内查找可能的上传 id（例如视频或元素的 id 属性为数字）
			let uploadId: string | undefined = undefined;
			modal.find('[id]').each((_, el) => {
				const iid = $(el).attr('id') || '';
				if (/^\d+$/.test(iid)) {
					uploadId = iid;
					return false; // break
				}
			});

			// 优先使用与 uploadId 相关联的 select（class 名如 script_id14736）
			let scriptSelect = undefined as any;
			if (uploadId) {
				scriptSelect = modal.find(`select.script_id${uploadId}`).first();
			}
			// 若未找到，退回到任意含 script_id 的 select
			if ((!scriptSelect || scriptSelect.length === 0)) {
				scriptSelect = modal.find("select[class*='script_id']").first();
			}

			if (scriptSelect && scriptSelect.length) {
				const sv = scriptSelect.val() as string | string[] | undefined;
				if (Array.isArray(sv)) {
					scriptId = sv.length ? String(sv[0]) : undefined;
				} else if (typeof sv === 'string') {
					scriptId = sv.trim() || undefined;
				}

				if (!scriptId) {
					// 尝试查找带 selected 的 option
					const sOpt = scriptSelect.find('option[selected]').first();
					if (sOpt.length) scriptId = (sOpt.attr('value') || '').trim() || undefined;
					else {
						const firstOpt = scriptSelect.find('option').first();
						if (firstOpt.length) scriptId = (firstOpt.attr('value') || '').trim() || undefined;
					}
				}
			}

			// 收集图片/媒体
			modal.find('img').each((_, img) => {
				const src = $(img).attr('src');
				if (src && !seen.has(src)) {
					seen.add(src);
					const parsed: ParsedImage = { url: src, itemTitle: itemTitle || '', scriptId: scriptId || undefined, auditStatus, auditStatusName };
					item.images.push(parsed);
				}
			});
			modal.find('audio,video,source').each((_, mtag) => {
				const src = $(mtag).attr('src');
				if (src && !seen.has(src)) {
					seen.add(src);
					const parsed: ParsedMedia = { url: src, itemTitle: itemTitle || '', scriptId: scriptId || undefined, auditStatus, auditStatusName };
					item.medias.push(parsed);
				}
			});
		});

		out.push(item);
	});

	// 提取总数
	let total = 0;
	const totalText = $('.box-footer').text();
	const match = totalText.match(/总共\s*([\d,]+)\s*条/);
	if (match) {
		total = parseInt(match[1].replace(/,/g, ''), 10);
	}

	return { list: out, total };
}

