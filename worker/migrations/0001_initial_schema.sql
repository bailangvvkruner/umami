-- Umami D1 Database Schema (SQLite)
-- Migrated from PostgreSQL Prisma Schema

-- User table
CREATE TABLE IF NOT EXISTS user (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    logo_url TEXT,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_username ON user(username);
CREATE INDEX IF NOT EXISTS idx_user_deleted_at ON user(deleted_at);

-- Team table
CREATE TABLE IF NOT EXISTS team (
    team_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    access_code TEXT UNIQUE,
    logo_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_team_access_code ON team(access_code);

-- TeamUser table (team membership)
CREATE TABLE IF NOT EXISTS team_user (
    team_user_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team-member',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES team(team_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_user_team_id ON team_user(team_id);
CREATE INDEX IF NOT EXISTS idx_team_user_user_id ON team_user(user_id);

-- Website table
CREATE TABLE IF NOT EXISTS website (
    website_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    share_id TEXT UNIQUE,
    reset_at TEXT,
    user_id TEXT,
    team_id TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES team(team_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES user(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_website_user_id ON website(user_id);
CREATE INDEX IF NOT EXISTS idx_website_team_id ON website(team_id);
CREATE INDEX IF NOT EXISTS idx_website_share_id ON website(share_id);
CREATE INDEX IF NOT EXISTS idx_website_created_at ON website(created_at);

-- Session table
CREATE TABLE IF NOT EXISTS session (
    session_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    browser TEXT,
    os TEXT,
    device TEXT,
    screen TEXT,
    language TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    distinct_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_website_id ON session(website_id);
CREATE INDEX IF NOT EXISTS idx_session_created_at ON session(created_at);
CREATE INDEX IF NOT EXISTS idx_session_website_created ON session(website_id, created_at);

-- WebsiteEvent table
CREATE TABLE IF NOT EXISTS website_event (
    event_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    visit_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    url_path TEXT NOT NULL,
    url_query TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    referrer_path TEXT,
    referrer_query TEXT,
    referrer_domain TEXT,
    page_title TEXT,
    gclid TEXT,
    fbclid TEXT,
    msclkid TEXT,
    ttclid TEXT,
    li_fat_id TEXT,
    twclid TEXT,
    event_type INTEGER DEFAULT 1,
    event_name TEXT,
    tag TEXT,
    hostname TEXT,
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES session(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_website_id ON website_event(website_id);
CREATE INDEX IF NOT EXISTS idx_event_session_id ON website_event(session_id);
CREATE INDEX IF NOT EXISTS idx_event_created_at ON website_event(created_at);
CREATE INDEX IF NOT EXISTS idx_event_website_created ON website_event(website_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_website_url ON website_event(website_id, created_at, url_path);
CREATE INDEX IF NOT EXISTS idx_event_website_event_name ON website_event(website_id, created_at, event_name);

-- EventData table
CREATE TABLE IF NOT EXISTS event_data (
    event_data_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    website_event_id TEXT NOT NULL,
    data_key TEXT NOT NULL,
    string_value TEXT,
    number_value REAL,
    date_value TEXT,
    data_type INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE,
    FOREIGN KEY (website_event_id) REFERENCES website_event(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_data_website_id ON event_data(website_id);
CREATE INDEX IF NOT EXISTS idx_event_data_event_id ON event_data(website_event_id);
CREATE INDEX IF NOT EXISTS idx_event_data_website_created ON event_data(website_id, created_at);

-- SessionData table
CREATE TABLE IF NOT EXISTS session_data (
    session_data_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    data_key TEXT NOT NULL,
    string_value TEXT,
    number_value REAL,
    date_value TEXT,
    data_type INTEGER NOT NULL,
    distinct_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES session(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_data_website_id ON session_data(website_id);
CREATE INDEX IF NOT EXISTS idx_session_data_session_id ON session_data(session_id);
CREATE INDEX IF NOT EXISTS idx_session_data_website_created ON session_data(website_id, created_at);

-- Report table
CREATE TABLE IF NOT EXISTS report (
    report_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    website_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parameters TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_user_id ON report(user_id);
CREATE INDEX IF NOT EXISTS idx_report_website_id ON report(website_id);
CREATE INDEX IF NOT EXISTS idx_report_type ON report(type);

-- Segment table
CREATE TABLE IF NOT EXISTS segment (
    segment_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    parameters TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segment_website_id ON segment(website_id);

-- Revenue table
CREATE TABLE IF NOT EXISTS revenue (
    revenue_id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    currency TEXT NOT NULL,
    revenue REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (website_id) REFERENCES website(website_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES session(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revenue_website_id ON revenue(website_id);
CREATE INDEX IF NOT EXISTS idx_revenue_session_id ON revenue(session_id);
CREATE INDEX IF NOT EXISTS idx_revenue_website_created ON revenue(website_id, created_at);

-- Link table (short links)
CREATE TABLE IF NOT EXISTS link (
    link_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    user_id TEXT,
    team_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES team(team_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_link_slug ON link(slug);
CREATE INDEX IF NOT EXISTS idx_link_user_id ON link(user_id);
CREATE INDEX IF NOT EXISTS idx_link_team_id ON link(team_id);

-- Pixel table (tracking pixels)
CREATE TABLE IF NOT EXISTS pixel (
    pixel_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    user_id TEXT,
    team_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES team(team_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pixel_slug ON pixel(slug);
CREATE INDEX IF NOT EXISTS idx_pixel_user_id ON pixel(user_id);
CREATE INDEX IF NOT EXISTS idx_pixel_team_id ON pixel(team_id);
