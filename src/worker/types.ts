export interface Env {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    ENVIRONMENT: string;
    APP_SECRET: string;
}

export interface User {
    id: string;
    username: string;
    password: string;
    role: string;
    logoUrl?: string;
    displayName?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

export interface Website {
    id: string;
    name: string;
    domain?: string;
    shareId?: string;
    resetAt?: string;
    userId?: string;
    teamId?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

export interface Session {
    id: string;
    websiteId: string;
    browser?: string;
    os?: string;
    device?: string;
    screen?: string;
    language?: string;
    country?: string;
    region?: string;
    city?: string;
    distinctId?: string;
    createdAt?: string;
}

export interface WebsiteEvent {
    id: string;
    websiteId: string;
    sessionId: string;
    visitId: string;
    createdAt?: string;
    urlPath: string;
    urlQuery?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referrerPath?: string;
    referrerQuery?: string;
    referrerDomain?: string;
    pageTitle?: string;
    gclid?: string;
    fbclid?: string;
    msclkid?: string;
    ttclid?: string;
    lifatid?: string;
    twclid?: string;
    eventType: number;
    eventName?: string;
    tag?: string;
    hostname?: string;
}

export interface Team {
    id: string;
    name: string;
    accessCode?: string;
    logoUrl?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

export interface TeamUser {
    id: string;
    teamId: string;
    userId: string;
    role: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AuthPayload {
    userId: string;
    role: string;
}

export const ROLES = {
    admin: 'admin',
    user: 'user',
    viewOnly: 'view-only',
    teamOwner: 'team-owner',
    teamManager: 'team-manager',
    teamMember: 'team-member',
} as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
    [ROLES.admin]: ['all'],
    [ROLES.user]: ['website:read', 'website:create', 'website:update', 'website:delete'],
    [ROLES.viewOnly]: ['website:read'],
    [ROLES.teamOwner]: ['team:read', 'team:update', 'team:delete', 'team:user:manage'],
    [ROLES.teamManager]: ['team:read', 'team:update'],
    [ROLES.teamMember]: ['team:read'],
};

export const EVENT_TYPES = {
    pageView: 1,
    customEvent: 2,
    linkEvent: 3,
    pixelEvent: 4,
} as const;

export const COLLECTION_TYPES = {
    event: 'event',
    identify: 'identify',
} as const;

export const URL_LENGTH = 500;
export const EVENT_NAME_LENGTH = 50;
export const PAGE_TITLE_LENGTH = 500;

export const SESSION_COLUMNS = ['browser', 'os', 'device', 'screen', 'language', 'country', 'region', 'city'];
export const EVENT_COLUMNS = ['url', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event'];
