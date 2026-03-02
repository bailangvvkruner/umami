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

export interface EventData {
    id: string;
    websiteId: string;
    websiteEventId: string;
    dataKey: string;
    stringValue?: string;
    numberValue?: number;
    dateValue?: string;
    dataType: number;
    createdAt?: string;
}

export interface SessionData {
    id: string;
    websiteId: string;
    sessionId: string;
    dataKey: string;
    stringValue?: string;
    numberValue?: number;
    dateValue?: string;
    dataType: number;
    distinctId?: string;
    createdAt?: string;
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

export interface Report {
    id: string;
    userId: string;
    websiteId: string;
    type: string;
    name: string;
    description?: string;
    parameters: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface Segment {
    id: string;
    websiteId: string;
    type: string;
    name: string;
    parameters: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface Revenue {
    id: string;
    websiteId: string;
    sessionId: string;
    eventId: string;
    eventName: string;
    currency: string;
    revenue?: number;
    createdAt?: string;
}

export interface Link {
    id: string;
    name: string;
    url: string;
    slug: string;
    userId?: string;
    teamId?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

export interface Pixel {
    id: string;
    name: string;
    slug: string;
    userId?: string;
    teamId?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

export interface AuthPayload {
    userId: string;
    role: string;
    iat: number;
    exp: number;
}

export interface CollectPayload {
    website: string;
    hostname?: string;
    url: string;
    referrer?: string;
    title?: string;
    language?: string;
    screen?: string;
    name?: string;
    tag?: string;
    data?: Record<string, any>;
    cache?: boolean;
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
    pageview: 1,
    event: 2,
} as const;

export const DATA_TYPES = {
    string: 1,
    number: 2,
    boolean: 3,
    date: 4,
    array: 5,
} as const;

export const URL_LENGTH = 500;
export const EVENT_NAME_LENGTH = 50;
export const PAGE_TITLE_LENGTH = 500;
export const SHARE_TOKEN_HEADER = 'x-umami-share-token';
export const TOKEN_HEADER = 'x-umami-token';
