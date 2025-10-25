export function extractTokenFromLoginHtml(html: string): string {
	// 优先从隐藏 input[name="_token"] 获取
	const match = html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/);
	if (match) return match[1];
	// 其次从 Dcat.token = "xxxx"; 获取
	const jsMatch = html.match(/Dcat\.token\s*=\s*["']([^"']+)["']/);
	if (jsMatch) return jsMatch[1];
	return '';
}

export type ActivityItem = {
	id: string;
	title: string;
}

export type ActivityDetailItem = {
	id: string;
	title: string;
}

export type PlatformItem = {
	id: string;
	title: string;
}

export function parseActivityListFromHtml(html: string): {
	activities: ActivityItem[];
	details: ActivityDetailItem[];
	platforms: PlatformItem[];
} {
	const $ = cheerio.load(html || '');
	const activities: ActivityItem[] = [];
	const details: ActivityDetailItem[] = [];
	const platforms: PlatformItem[] = [];

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

	return { activities, details, platforms };
}
import * as cheerio from 'cheerio';

export type ReviewItem = {
	id: string;
	activityTitle: string;
	itemTitle: string;
	platformName: string;
	groupName: string;
	nickname: string;
	uid: string;
	phone: string;
	logDetailHtml: string; // raw inner HTML for detail (may include modal links)
	uploadTime: string;
	votes: string;
	auditor: string;
	auditTime: string;
	auditActionHtml: string; // raw inner HTML for action (may be a link)
	auditResult: string;
	image: string;
	media: string;
	modalId?: string;
	auditToken?: string;
	_success?: 0 | 1 | 2; // internal use only
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
			image: '',
			media: '',
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

		const modalIds = [...collectModalIds(item.logDetailHtml), ...collectModalIds(item.auditActionHtml)];
		const seen = new Set<string>();
		modalIds.forEach(id => {
			const modal = $(`#${id}`);
			if (!modal || modal.length === 0) return;
			modal.find('img').each((_, img) => {
				const src = $(img).attr('src');
				if (src && !seen.has(src)) {
					seen.add(src); if (!item.image) {
						item.image = src;
					}
				}
			});
			modal.find('audio,video,source').each((_, mtag) => {
				const src = $(mtag).attr('src');
				if (src && !seen.has(src)) {
					seen.add(src);
					if (!item.media) {
						item.media = src;
					}
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

export default parseReviewListFromHtml;
