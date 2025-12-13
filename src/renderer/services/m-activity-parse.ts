import * as cheerio from 'cheerio';
import { ActivityItem, ActivityDetailItem, AuditStatus, ReviewItem, ScriptOptions, ParsedImage, ParsedMedia } from '.';
// 引用 postmanParser.ts 的类型

// 辅助：从 select 元素中以统一策略读取 value 和显示名称
function getSelectValueAndName($select: any): { value?: string; name?: string } {
	if (!$select || $select.length === 0) return {};
	// 优先选中项
	const selOpt = $select.find('option[selected]').first();
	let value: string | undefined;
	let name: string | undefined;
	if (selOpt.length) {
		value = (selOpt.attr('value') || '').trim() || undefined;
		name = selOpt.text().trim();
	} else {
		const val = $select.val();
		if (Array.isArray(val)) value = val.length ? String(val[0]).trim() : undefined;
		else if (typeof val === 'string') value = val.trim() || undefined;
		// 回退到第一个 option
		if (!value) {
			const firstOpt = $select.find('option').first();
			if (firstOpt.length) value = (firstOpt.attr('value') || '').trim() || undefined;
		}
		if (value) {
			const opt = $select.find(`option[value="${value}"]`).first();
			if (opt.length) name = opt.text().trim();
		}
		if (!name) name = $select.find('option').first().text().trim();
	}
	return { value, name };
}

// 辅助：将审核文字映射为 0|1|2
function auditNameToStatus(name?: string): 0 | 1 | 2 {
	const txt = (name || '').toString();
	if (txt.indexOf('未审核') !== -1) return 1;
	if (txt.indexOf('未通过') !== -1 || txt.indexOf('审核未通过') !== -1) return 2;
	return 0;
}

/**
 * 从 HTML 中提取 token
 * 用于表单提交的 CSRF token
 */
export function extractTokenFromHtml(html: string): string {
	// 优先从 Dcat 对象中获取
	const dcatMatch = html.match(/var\s+Dcat\s*=\s*CreateDcat\s*\(\s*{[^}]*"token"\s*:\s*"([^"]+)"/);
	if (dcatMatch) return dcatMatch[1];

	// 从 Dcat.token 赋值语句中获取
	const tokenMatch = html.match(/Dcat\.token\s*=\s*["']([^"']+)["']/);
	if (tokenMatch) return tokenMatch[1];

	// 从隐藏 input 中获取
	const inputMatch = html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/);
	if (inputMatch) return inputMatch[1];

	return '';
}

/**
 * 审核状态类型
 */


/**
 * 从筛选表单中解析活动、明细活动和审核状态
 */
export function parseFilterOptionsFromHtml(html: string) {
	const $ = cheerio.load(html || '');
	const activities: ActivityItem[] = [];
	const items: ActivityDetailItem[] = [];
	const auditStatuses: AuditStatus[] = [];
	const scriptOptions: ScriptOptions[] = parseScriptOptionsFromHtml(html);
	// 解析活动标题选项
	$('select.activity_id option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) activities.push({ id, title });
	});

	// 解析明细活动标题选项
	$('select.item_id option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) items.push({ id, title });
	});

	// 解析审核结果选项
	$('select.audit_status option').each((_, el) => {
		const id = $(el).attr('value') || '';
		const title = $(el).text().trim();
		if (id) auditStatuses.push({ id, title });
	});

	return { activities, items, auditStatuses, scriptOptions };
}

/**
 * 从表格中解析审核记录列表
 */
export function parseReviewItemsFromHtml(html: string): {
	records: ReviewItem[];
	total: number;
	currentPage: number;
	perPage: number;
	totalPages: number;
} {
	const $ = cheerio.load(html || '');
	const records: ReviewItem[] = [];

	// 不再预解析 images；所有解析工作在此函数内完成，避免二次遍历

	// 解析表格数据
	$('#grid-table tbody tr').each((_, tr) => {
		const tds = $(tr).find('td');
		if (tds.length < 10) return;

		const getText = (i: number) => $(tds[i]).text().replace(/\u00a0/g, ' ').trim();
		const getHtml = (i: number) => $(tds[i]).html() || '';

		const record: ReviewItem = {
			id: '', // 将从 modal 中提取
			activityTitle: getText(0),
			itemTitle: getText(2),
			uid: getText(3),
			phone: getText(4),
			uploadTime: getText(5),
			auditResult: getText(6),
			auditor: getText(7),
			auditTime: getText(8),
			auditActionHtml: getHtml(9),
			images: [],
			medias: [],
		};

		// 从操作列提取模态框 ID
		const modalMatch = record.auditActionHtml?.match(/data-target=["']#([^"']+)["']/);
		if (modalMatch) {
			record.modalId = modalMatch[1];

			// 查找对应的模态框并提取媒体资源
			const modal = $(`#${record.modalId}`);
			if (modal.length > 0) {
				// 提取审核 token
				const tokenMatch = modal.html()?.match(/audit_token=["']([^"']+)["']/);
				if (tokenMatch) {
					record.auditToken = tokenMatch[1];
				}

				// 从 modal 内解析 itemTitle（优先 td[width="180"]）
				const modalItemTitle = modal.find('td[width="180"]').first().text().replace(/\s+/g, ' ').trim() || record.itemTitle || '';

				const seen = new Set<string>();

				modal.find('img.user_upload_img').each((_, img) => {
					const src = $(img).attr('src');
					if (!src || seen.has(src)) return;
					seen.add(src);

					const imgId = $(img).attr('id') || $(img).attr('data-id') || '';
					const sSelect = modal.find(`select[data-id="${imgId}"][class*="script_id"]`).first();
					const aSelect = modal.find(`select[data-id="${imgId}"][class*="audit_sta"]`).first();
					const sInfo = getSelectValueAndName(sSelect);
					const scriptId: string | undefined = sInfo.value;
					const auditInfo = getSelectValueAndName(aSelect);
					const auditStatusName: string | undefined = auditInfo.name || '';
					const auditStatus = auditNameToStatus(auditStatusName);
					if (!record.images) record.images = [];
					record.images.push({ url: src, itemTitle: modalItemTitle, auditStatus, auditStatusName, scriptId: scriptId, uploadId: imgId || undefined });
				});

				const firstImg = modal.find('img.user_upload_img').first();
				if (firstImg.length > 0) {
					const imgId = firstImg.attr('id');
					if (imgId) {
						record.id = imgId;
					}
				}

				// 媒体（video/audio/source）：解析为 ParsedMedia 对象
				modal.find('video source, video, audio, source').each((_, video) => {
					const src = $(video).attr('src');
					if (!src || seen.has(src)) return;
					seen.add(src);

					const vId = $(video).attr('id') || $(video).attr('data-id') || '';
					const sSelect = modal.find(`select[data-id="${vId}"][class*="script_id"]`).first();
					const aSelect = modal.find(`select[data-id="${vId}"][class*="audit_sta"]`).first();
					const sInfo = getSelectValueAndName(sSelect);
					const vScriptId: string | undefined = sInfo.value;
					const auditInfo = getSelectValueAndName(aSelect);
					const auditStatusName: string | undefined = auditInfo.name || '';
					const auditStatus = auditNameToStatus(auditStatusName);
					if (!record.medias) record.medias = [];
					const parsedMedia: ParsedMedia = { url: src, itemTitle: modalItemTitle, scriptId: vScriptId, auditStatus, auditStatusName, uploadId: vId || undefined };
					record.medias.push(parsedMedia);
				});
			}
		}

		records.push(record);
	});

	// 解析分页信息
	let total = 0;
	let currentPage = 1;
	let perPage = 10;

	// 提取总数
	const footerText = $('.box-footer').text();
	const totalMatch = footerText.match(/总共\s*<b>(\d+)<\/b>\s*条/) || footerText.match(/总共\s*(\d+)\s*条/);
	if (totalMatch) {
		total = parseInt(totalMatch[1], 10);
	}

	// 提取当前页
	const activePage = $('.pagination .page-item.active .page-link').text().trim();
	if (activePage) {
		currentPage = parseInt(activePage, 10) || 1;
	}

	// 提取每页数量
	const perPageMatch = footerText.match(/从\s*<b>\d+<\/b>\s*到\s*<b>(\d+)<\/b>/) ||
		footerText.match(/到\s*(\d+)/);
	if (perPageMatch && currentPage === 1) {
		perPage = parseInt(perPageMatch[1], 10) || 10;
	} else {
		// 尝试从下拉选择器获取
		const selectedPerPage = $('.per-pages-selector .dropdown-toggle stub').text().trim();
		if (selectedPerPage) {
			perPage = parseInt(selectedPerPage, 10) || 10;
		}
	}

	const totalPages = Math.ceil(total / perPage);

	return {
		records,
		total,
		currentPage,
		perPage,
		totalPages,
	};
}

/**
 * 解析页面中所有 script options（各 modal 中的 script 选择项）
 */
export function parseScriptOptionsFromHtml(html: string): ScriptOptions[] {
	const $ = cheerio.load(html || '');
	const map = new Map<string, string>();

	// 查找 class 属性包含 script_id 的 select（如 script_id68...）
	$('select').each((_, el) => {
		const cls = $(el).attr('class') || '';
		if (cls.indexOf('script_id') === -1) return;

		$(el).find('option').each((_, opt) => {
			const id = $(opt).attr('value') || '';
			const title = $(opt).text().trim();
			if (id) map.set(id, title);
		});
	});

	const out: ScriptOptions[] = [];
	map.forEach((title, id) => out.push({ id, title }));
	return out;
}

/**
 * 解析页面中所有图片，并将图片与同一 modal 表格中前一列 width='180' 的文本配对，返回 ParsedImage[]
 */
export function parseParsedImagesFromHtml(html: string): ParsedImage[] {
	const $ = cheerio.load(html || '');
	const out: ParsedImage[] = [];
	const seen = new Set<string>();

	$('div[id^="modal-"]').each((_, modalEl) => {
		const modal = $(modalEl);

		modal.find('td[width="180"]').each((_, td) => {
			const itemTitle = $(td).text().replace(/\s+/g, ' ').trim();
			const nextTd = $(td).next();
			if (!nextTd || nextTd.length === 0) return;

			// 从 modal 中解析审核状态，使用统一的 select 提取策略
			const auditSelect = modal.find("select[class*='audit_sta']").first();
			const auditInfo = getSelectValueAndName(auditSelect);
			const auditStatusName = auditInfo.name || '';
			const auditStatus = auditNameToStatus(auditStatusName);

			// 查找图片元素，每张图片单独查找对应的 scriptSelect
			nextTd.find('img').each((_, img) => {
				const src = $(img).attr('src') || '';
				if (!src) return;
				if (seen.has(src)) return;
				seen.add(src);

				// 获取图片的 id 或 data-id 作为 uploadId
				const imgId = $(img).attr('id') || $(img).attr('data-id') || '';
				let scriptSelect: any;
				let scriptId: string | undefined = undefined;
				if (imgId) {
					// 根据图片的 id/data-id 查找对应的 select[data-id="{imgId}"]
					scriptSelect = modal.find(`select[data-id="${imgId}"][class*="script_id"]`).first();

					if (!scriptSelect || scriptSelect.length === 0) {
						// 如果没找到，尝试查找 class 包含该 id 的 select
						scriptSelect = modal.find(`select[class*="script_id"][class*="${imgId}"]`).first();
					}
				}

				// 如果还是没找到，回退到第一个 script_id select
				if (!scriptSelect || scriptSelect.length === 0) {
					scriptSelect = modal.find("select[class*='script_id']").first();
				}

				if (scriptSelect && scriptSelect.length > 0) {
					const scriptInfo = getSelectValueAndName(scriptSelect);
					scriptId = scriptInfo.value;
				}

				out.push({ url: src, itemTitle, auditStatus, auditStatusName, scriptId, uploadId: imgId });
			});

			// 若存在 video/source，也尝试收集 source src
			nextTd.find('video source, video').each((_, v) => {
				const src = $(v).attr('src') || '';
				if (!src) return;
				if (seen.has(src)) return;
				seen.add(src);

				// 获取视频的 id 或 data-id 作为 uploadId
				const videoId = $(v).attr('id') || $(v).attr('data-id') || '';
				let scriptSelect: any;
				let scriptId: string | undefined = undefined;

				if (videoId) {
					// 根据视频的 id/data-id 查找对应的 select[data-id="{videoId}"]
					scriptSelect = modal.find(`select[data-id="${videoId}"][class*="script_id"]`).first();

					if (!scriptSelect || scriptSelect.length === 0) {
						scriptSelect = modal.find(`select[class*="script_id"][class*="${videoId}"]`).first();
					}
				}

				// 如果还是没找到，回退到第一个 script_id select
				if (!scriptSelect || scriptSelect.length === 0) {
					scriptSelect = modal.find("select[class*='script_id']").first();
				}

				if (scriptSelect && scriptSelect.length > 0) {
					const scriptInfo = getSelectValueAndName(scriptSelect);
					scriptId = scriptInfo.value;
				}

				out.push({ url: src, itemTitle, auditStatus, auditStatusName, scriptId, uploadId: videoId });
			});
		});
	});

	return out;
}

/**
 * 用户信息类型
 */
export type UserInfo = {
	username: string;
	status: string;
	avatar: string;
}

/**
 * 从页面中提取当前登录用户信息
 */
export function parseUserInfoFromHtml(html: string): UserInfo | null {
	const $ = cheerio.load(html || '');

	const username = $('.dropdown-user .user-name').text().trim();
	const status = $('.dropdown-user .user-status').text().trim();
	const avatar = $('.dropdown-user img.round').attr('src') || '';

	if (!username) return null;

	return {
		username,
		status,
		avatar,
	};
}

/**
 * 菜单项类型
 */
export type MenuItem = {
	id: string;
	title: string;
	icon?: string;
	href?: string;
	isActive: boolean;
	children?: MenuItem[];
}

/**
 * 从侧边栏中解析菜单结构
 */
export function parseMenuFromHtml(html: string): MenuItem[] {
	const $ = cheerio.load(html || '');
	const menuItems: MenuItem[] = [];

	// 解析顶级菜单项
	$('.sidebar > ul.nav > li.nav-item').each((_, li) => {
		const $li = $(li);
		const $link = $li.find('> a.nav-link');

		const item: MenuItem = {
			id: $link.attr('data-id') || '',
			title: $link.find('p').first().text().trim(),
			icon: $link.find('i').first().attr('class') || '',
			href: $link.attr('href') || '',
			isActive: $link.hasClass('active'),
			children: [],
		};

		// 解析子菜单
		const $submenu = $li.find('> ul.nav-treeview');
		if ($submenu.length > 0) {
			$submenu.find('> li.nav-item').each((_, subLi) => {
				const $subLink = $(subLi).find('> a.nav-link');
				const subItem: MenuItem = {
					id: $subLink.attr('data-id') || '',
					title: $subLink.find('p').first().text().trim(),
					icon: $subLink.find('i').first().attr('class') || '',
					href: $subLink.attr('href') || '',
					isActive: $subLink.hasClass('active'),
				};

				// 递归解析更深层的子菜单
				const $deepSubmenu = $(subLi).find('> ul.nav-treeview');
				if ($deepSubmenu.length > 0) {
					subItem.children = [];
					$deepSubmenu.find('> li.nav-item').each((_, deepLi) => {
						const $deepLink = $(deepLi).find('> a.nav-link');
						const deepItem: MenuItem = {
							id: $deepLink.attr('data-id') || '',
							title: $deepLink.find('p').first().text().trim(),
							icon: $deepLink.find('i').first().attr('class') || '',
							href: $deepLink.attr('href') || '',
							isActive: $deepLink.hasClass('active'),
						};
						subItem.children!.push(deepItem);
					});
				}

				item.children!.push(subItem);
			});
		}

		menuItems.push(item);
	});

	return menuItems;
}

/**
 * 综合解析函数 - 一次性解析所有信息
 */
export function parseTemplateData(html: string) {
	return {
		token: extractTokenFromHtml(html),
		user: parseUserInfoFromHtml(html),
		filterOptions: parseFilterOptionsFromHtml(html),
		auditData: parseReviewItemsFromHtml(html),
		menu: parseMenuFromHtml(html),
	};
}

export default parseTemplateData;
