import * as cheerio from 'cheerio';
// 引用 postmanParser.ts 的类型
import type { ActivityItem, ActivityDetailItem, PlatformItem, ReviewItem } from './postmanParser';

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
export type AuditStatus = {
    id: string;
    title: string;
}

/**
 * 从筛选表单中解析活动、明细活动和审核状态
 */
export function parseFilterOptionsFromHtml(html: string): {
    activities: ActivityItem[];
    items: ActivityDetailItem[];
    auditStatuses: AuditStatus[];
} {
    const $ = cheerio.load(html || '');
    const activities: ActivityItem[] = [];
    const items: ActivityDetailItem[] = [];
    const auditStatuses: AuditStatus[] = [];

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

    return { activities, items, auditStatuses };
}

/**
 * 从表格中解析审核记录列表
 */
export function parseReviewItemsFromHtml(html: string): {
    records: Partial<ReviewItem>[];
    total: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
} {
    const $ = cheerio.load(html || '');
    const records: Partial<ReviewItem>[] = [];

    // 解析表格数据
    $('#grid-table tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 10) return;

        const getText = (i: number) => $(tds[i]).text().replace(/\u00a0/g, ' ').trim();
        const getHtml = (i: number) => $(tds[i]).html() || '';

        const record: Partial<ReviewItem> = {
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
            media: [],
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

                // 提取图片 - 修复选择器
                modal.find('img.user_upload_img').each((_, img) => {
                    const src = $(img).attr('src');
                    if (src && !record.images?.includes(src)) {
                        record.images?.push(src);
                    }
                });

                // 从图片 id 属性提取记录 id
                const firstImg = modal.find('img.user_upload_img').first();
                if (firstImg.length > 0) {
                    const imgId = firstImg.attr('id');
                    if (imgId) {
                        record.id = imgId;
                    }
                }

                // 提取视频
                modal.find('video source, video').each((_, video) => {
                    const src = $(video).attr('src');
                    if (src && !record.media?.includes(src)) {
                        record.media?.push(src);
                    }
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
