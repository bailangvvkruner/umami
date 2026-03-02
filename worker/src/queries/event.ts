import { Database, toDate } from '../lib/db';
import { WebsiteEvent, EVENT_TYPES, URL_LENGTH, EVENT_NAME_LENGTH, PAGE_TITLE_LENGTH } from '../types';
import { uuid } from '../lib/crypto';

export interface SaveEventArgs {
    websiteId: string;
    sessionId: string;
    visitId: string;
    eventType: number;
    createdAt?: Date;
    pageTitle?: string;
    hostname?: string;
    urlPath: string;
    urlQuery?: string;
    referrerPath?: string;
    referrerQuery?: string;
    referrerDomain?: string;
    eventName?: string;
    tag?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    gclid?: string;
    fbclid?: string;
    msclkid?: string;
    ttclid?: string;
    lifatid?: string;
    twclid?: string;
}

export async function saveEvent(db: Database, args: SaveEventArgs): Promise<string> {
    const eventId = uuid();
    const now = toDate(args.createdAt || new Date());

    const sql = `
        INSERT INTO website_event (
            event_id, website_id, session_id, visit_id, created_at,
            url_path, url_query, page_title, hostname,
            referrer_path, referrer_query, referrer_domain,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            gclid, fbclid, msclkid, ttclid, li_fat_id, twclid,
            event_type, event_name, tag
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)
    `;

    await db.execute(sql, [
        eventId,
        args.websiteId,
        args.sessionId,
        args.visitId,
        now,
        args.urlPath?.substring(0, URL_LENGTH) || '',
        args.urlQuery?.substring(0, URL_LENGTH) || null,
        args.pageTitle?.substring(0, PAGE_TITLE_LENGTH) || null,
        args.hostname || null,
        args.referrerPath?.substring(0, URL_LENGTH) || null,
        args.referrerQuery?.substring(0, URL_LENGTH) || null,
        args.referrerDomain?.substring(0, URL_LENGTH) || null,
        args.utmSource || null,
        args.utmMedium || null,
        args.utmCampaign || null,
        args.utmContent || null,
        args.utmTerm || null,
        args.gclid || null,
        args.fbclid || null,
        args.msclkid || null,
        args.ttclid || null,
        args.lifatid || null,
        args.twclid || null,
        args.eventType || EVENT_TYPES.pageview,
        args.eventName?.substring(0, EVENT_NAME_LENGTH) || null,
        args.tag || null,
    ]);

    return eventId;
}

export async function getEventsByWebsiteId(
    db: Database,
    websiteId: string,
    options: {
        page?: number;
        pageSize?: number;
        startAt?: string;
        endAt?: string;
        eventType?: number;
        eventName?: string;
        urlPath?: string;
    } = {}
): Promise<{ data: WebsiteEvent[]; total: number }> {
    const { page = 1, pageSize = 10, startAt, endAt, eventType, eventName, urlPath } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE website_id = ?';
    const params: any[] = [websiteId];

    if (startAt) {
        whereClause += ' AND created_at >= ?';
        params.push(startAt);
    }
    if (endAt) {
        whereClause += ' AND created_at <= ?';
        params.push(endAt);
    }
    if (eventType !== undefined) {
        whereClause += ' AND event_type = ?';
        params.push(eventType);
    }
    if (eventName) {
        whereClause += ' AND event_name = ?';
        params.push(eventName);
    }
    if (urlPath) {
        whereClause += ' AND url_path LIKE ?';
        params.push(`%${urlPath}%`);
    }

    const countSql = `SELECT COUNT(*) as count FROM website_event ${whereClause}`;
    const countResult = await db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
        SELECT 
            event_id as id,
            website_id as websiteId,
            session_id as sessionId,
            visit_id as visitId,
            created_at as createdAt,
            url_path as urlPath,
            url_query as urlQuery,
            page_title as pageTitle,
            hostname,
            referrer_path as referrerPath,
            referrer_query as referrerQuery,
            referrer_domain as referrerDomain,
            utm_source as utmSource,
            utm_medium as utmMedium,
            utm_campaign as utmCampaign,
            utm_content as utmContent,
            utm_term as utmTerm,
            gclid,
            fbclid,
            msclkid,
            ttclid,
            li_fat_id as lifatid,
            twclid,
            event_type as eventType,
            event_name as eventName,
            tag
        FROM website_event 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
    `;

    const data = await db.query<WebsiteEvent>(sql, params);

    return { data, total };
}

export interface WebsiteStats {
    pageviews: number;
    uniques: number;
    bounces: number;
    totaltime: number;
}

export async function getWebsiteStats(
    db: Database,
    websiteId: string,
    startAt: string,
    endAt: string
): Promise<WebsiteStats> {
    const sql = `
        SELECT 
            COUNT(*) as pageviews,
            COUNT(DISTINCT session_id) as uniques,
            SUM(CASE WHEN visits = 1 THEN 1 ELSE 0 END) as bounces,
            SUM(CASE WHEN visits > 1 THEN visits - 1 ELSE 0 END) as totaltime
        FROM (
            SELECT session_id, COUNT(*) as visits
            FROM website_event 
            WHERE website_id = ? 
                AND created_at >= ? 
                AND created_at <= ?
                AND event_type = 1
            GROUP BY session_id
        )
    `;

    const result = await db.queryOne<{ pageviews: number; uniques: number; bounces: number; totaltime: number }>(
        sql,
        [websiteId, startAt, endAt]
    );

    return result || { pageviews: 0, uniques: 0, bounces: 0, totaltime: 0 };
}

export interface PageviewMetric {
    x: string;
    y: number;
}

export async function getPageviews(
    db: Database,
    websiteId: string,
    startAt: string,
    endAt: string,
    unit: 'hour' | 'day' | 'month' = 'day'
): Promise<PageviewMetric[]> {
    let dateFormat: string;
    switch (unit) {
        case 'hour':
            dateFormat = '%Y-%m-%d %H:00:00';
            break;
        case 'month':
            dateFormat = '%Y-%m-01';
            break;
        default:
            dateFormat = '%Y-%m-%d';
    }

    const sql = `
        SELECT 
            strftime('${dateFormat}', created_at) as x,
            COUNT(*) as y
        FROM website_event 
        WHERE website_id = ? 
            AND created_at >= ? 
            AND created_at <= ?
            AND event_type = 1
        GROUP BY x
        ORDER BY x
    `;

    return db.query<PageviewMetric>(sql, [websiteId, startAt, endAt]);
}

export interface MetricItem {
    x: string;
    y: number;
}

export async function getMetrics(
    db: Database,
    websiteId: string,
    startAt: string,
    endAt: string,
    field: string,
    limit: number = 10
): Promise<MetricItem[]> {
    const allowedFields = ['url_path', 'referrer_domain', 'browser', 'os', 'device', 'country', 'city', 'event_name'];
    if (!allowedFields.includes(field)) {
        return [];
    }

    const sql = `
        SELECT 
            ${field} as x,
            COUNT(*) as y
        FROM website_event we
        ${field === 'browser' || field === 'os' || field === 'device' || field === 'country' || field === 'city' 
            ? 'JOIN session s ON we.session_id = s.session_id' 
            : ''}
        WHERE we.website_id = ? 
            AND we.created_at >= ? 
            AND we.created_at <= ?
        GROUP BY x
        ORDER BY y DESC
        LIMIT ${limit}
    `;

    return db.query<MetricItem>(sql, [websiteId, startAt, endAt]);
}
