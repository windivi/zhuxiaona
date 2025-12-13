export type AuditStatus = {
	id: string;
	title: string;
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
export type ReviewItem = {
	id: string;
	activityTitle: string;
	itemTitle: string;
	platformName?: string;
	groupName?: string;
	nickname?: string;
	uid: string;
	phone: string;
	logDetailHtml?: string; // raw inner HTML for detail (may include modal links)
	uploadTime: string;
	votes?: string;
	auditor: string;
	auditTime: string;
	auditActionHtml: string; // raw inner HTML for action (may be a link)
	auditResult: string;
	images: ParsedImage[]; // parsed images/media (use parseParsedImagesFromHtml to fill)
	medias: ParsedMedia[];
	modalId?: string;
	auditToken?: string;
	_success?: 0 | 1 | 2; // internal use only
}
export type ScriptOptions = {
	id: string;
	title: string;
}
export type ParsedImage = {
	url: string;
	itemTitle: string;
	scriptId?: string;
	auditStatus?: 0 | 1 | 2;
	auditStatusName?: string;
	uploadId?: string;
}
export type ParsedMedia = {
	url: string;
	itemTitle: string;
	scriptId?: string;
	auditStatus?: 0 | 1 | 2;
	auditStatusName?: string;
	uploadId?: string;
}

// ============================================
// HTTP 客户端导出
// ============================================

// 导出 HTTP 客户端
export { default as httpClient, HttpClient } from './http-client'