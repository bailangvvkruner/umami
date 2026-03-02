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
    eventData?: Record<string, any>;
    distinctId?: string;
    browser?: string;
    os?: string;
    device?: string;
    screen?: string;
    language?: string;
    country?: string;
    region?: string;
    city?: string;
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        args.eventType || EVENT_TYPES.pageView,
        args.eventName?.substring(0, EVENT_NAME_LENGTH) || null,
        args.tag || null,
    ]);

    if (args.eventData && Object.keys(args.eventData).length > 0) {
        await saveEventData(db, {
            websiteId: args.websiteId,
            websiteEventId: eventId,
            eventData: args.eventData,
            createdAt: args.createdAt,
        });
    }

    return eventId;
}

export async function saveEventData(
    db: Database,
    args: {
        websiteId: string;
        websiteEventId: string;
        eventData: Record<string, any>;
        createdAt?: Date;
    }
): Promise<void> {
    const now = toDate(args.createdAt || new Date());

    for (const [key, value] of Object.entries(args.eventData)) {
        const id = uuid();
        let stringValue: string | null = null;
        let numberValue: number | null = null;
        let dateValue: string | null = null;
        let dataType = 1;

        if (typeof value === 'number') {
            numberValue = value;
            dataType = 2;
        } else if (value instanceof Date) {
            dateValue = value.toISOString();
            dataType = 4;
        } else if (typeof value === 'boolean') {
            numberValue = value ? 1 : 0;
            dataType = 3;
        } else {
            stringValue = String(value);
        }

        await db.execute(
            `INSERT INTO event_data (event_data_id, website_id, website_event_id, data_key, string_value, number_value, date_value, data_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, args.websiteId, args.websiteEventId, key, stringValue, numberValue, dateValue, dataType, now]
        );
    }
}

export async function getWebsiteEvents(
    db: Database,
    websiteId: string,
    options: {
        page?: number;
        pageSize?: number;
        startAt?: number;
        endAt?: number;
        eventType?: number;
        eventName?: string;
        urlPath?: string;
    } = {}
): Promise<{ data: any[]; count: number }> {
    const { page = 1, pageSize = 10, startAt, endAt, eventType, eventName, urlPath } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE website_id = ?';
    const params: any[] = [websiteId];

    if (startAt) {
        whereClause += ' AND created_at >= ?';
        params.push(new Date(startAt).toISOString());
    }
    if (endAt) {
        whereClause += ' AND created_at <= ?';
        params.push(new Date(endAt).toISOString());
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
    const count = countResult?.count || 0;

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
            event_type as eventType,
            event_name as eventName,
            tag
        FROM website_event 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.query(sql, [...params, pageSize, offset]);

    return { data, count };
}

export async function getWebsiteStats(
    db: Database,
    websiteId: string,
    startAt: number,
    endAt: number
): Promise<{ pageviews: number; uniques: number; bounces: number; totaltime: number }> {
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
        [websiteId, new Date(startAt).toISOString(), new Date(endAt).toISOString()]
    );

    return result || { pageviews: 0, uniques: 0, bounces: 0, totaltime: 0 };
}

export async function getPageviews(
    db: Database,
    websiteId: string,
    startAt: number,
    endAt: number,
    unit: 'hour' | 'day' | 'month' = 'day'
): Promise<{ x: string; y: number }[]> {
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

    return db.query(sql, [websiteId, new Date(startAt).toISOString(), new Date(endAt).toISOString()]);
}

export async function getMetrics(
    db: Database,
    websiteId: string,
    startAt: number,
    endAt: number,
    type: string,
    limit: number = 10
): Promise<{ x: string; y: number }[]> {
    const sessionColumns = ['browser', 'os', 'device', 'screen', 'language', 'country', 'region', 'city'];
    const eventColumns: Record<string, string> = {
        url: 'url_path',
        referrer: 'referrer_domain',
        'utm_source': 'utm_source',
        'utm_medium': 'utm_medium',
        'utm_campaign': 'utm_campaign',
        'utm_content': 'utm_content',
        'utm_term': 'utm_term',
        event: 'event_name',
    };

    if (sessionColumns.includes(type)) {
        const sql = `
            SELECT 
                s.${type} as x,
                COUNT(*) as y
            FROM website_event we
            JOIN session s ON we.session_id = s.session_id
            WHERE we.website_id = ? 
                AND we.created_at >= ? 
                AND we.created_at <= ?
            GROUP BY x
            ORDER BY y DESC
            LIMIT ?
        `;
        return db.query(sql, [websiteId, new Date(startAt).toISOString(), new Date(endAt).toISOString(), limit]);
    }

    const column = eventColumns[type] || 'url_path';
    
    if (type === 'event') {
        const sql = `
            SELECT 
                ${column} as x,
                COUNT(*) as y
            FROM website_event 
            WHERE website_id = ? 
                AND created_at >= ? 
                AND created_at <= ?
                AND event_type = 2
            GROUP BY x
            ORDER BY y DESC
            LIMIT ?
        `;
        return db.query(sql, [websiteId, new Date(startAt).toISOString(), new Date(endAt).toISOString(), limit]);
    }

    const sql = `
        SELECT 
            ${column} as x,
            COUNT(*) as y
        FROM website_event 
        WHERE website_id = ? 
            AND created_at >= ? 
            AND created_at <= ?
        GROUP BY x
        ORDER BY y DESC
        LIMIT ?
    `;
    return db.query(sql, [websiteId, new Date(startAt).toISOString(), new Date(endAt).toISOString(), limit]);
}

export async function getActiveVisitors(db: Database, websiteId: string): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() - 5 * 60 * 1000);
    const thresholdStr = toDate(threshold);

    const sql = `
        SELECT COUNT(DISTINCT session_id) as count 
        FROM website_event 
        WHERE website_id = ? AND created_at >= ?
    `;

    const result = await db.queryOne<{ count: number }>(sql, [websiteId, thresholdStr]);
    return result?.count || 0;
}
