import bcrypt from 'bcryptjs';
import { uuid } from './lib/crypto';
import { Database } from './lib/db';
import { Env } from './types';

export async function seedDatabase(env: Env): Promise<void> {
    const db = new Database(env.DB);

    const adminExists = await db.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM user WHERE role = 'admin'"
    );

    if (adminExists && adminExists.count > 0) {
        console.log('Database already seeded');
        return;
    }

    const adminId = uuid();
    const hashedPassword = await bcrypt.hash('admin', 10);
    const now = new Date().toISOString();

    await db.execute(
        `INSERT INTO user (user_id, username, password, role, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', ?, ?)`,
        [adminId, 'admin', hashedPassword, now, now]
    );

    const websiteId = uuid();
    await db.execute(
        `INSERT INTO website (website_id, name, domain, user_id, created_at, updated_at)
         VALUES (?, 'Demo Website', 'example.com', ?, ?, ?)`,
        [websiteId, adminId, now, now]
    );

    console.log('Database seeded successfully');
    console.log('Admin user: admin / admin');
    console.log('Demo website ID:', websiteId);
}

export async function createAdminUser(
    env: Env,
    username: string,
    password: string
): Promise<{ id: string; username: string }> {
    const db = new Database(env.DB);

    const existing = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM user WHERE username = ?',
        [username]
    );

    if (existing && existing.count > 0) {
        throw new Error('Username already exists');
    }

    const id = uuid();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await db.execute(
        `INSERT INTO user (user_id, username, password, role, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', ?, ?)`,
        [id, username, hashedPassword, now, now]
    );

    return { id, username };
}
