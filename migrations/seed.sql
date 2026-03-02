-- Seed data for Umami Worker
-- Default admin user: admin / admin (password is bcrypt hashed)

INSERT INTO user (user_id, username, password, role, display_name, created_at, updated_at)
VALUES (
    'admin-00000000-0000-0000-0000-000000000001',
    'admin',
    '$2a$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm',
    'admin',
    'Administrator',
    datetime('now'),
    datetime('now')
);

-- Demo website
INSERT INTO website (website_id, name, domain, user_id, created_at, updated_at)
VALUES (
    'website-00000000-0000-0000-0000-000000000001',
    'Demo Website',
    'example.com',
    'admin-00000000-0000-0000-0000-000000000001',
    datetime('now'),
    datetime('now')
);
