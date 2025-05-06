import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({
    path: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../.env'
    ),
});

if (!process.env.DB_PORT) {
    throw new Error('DB_PORT is not set');
}

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
};

export class DbSession {
    private client: pg.PoolClient | null;
    private completed: boolean;

    private constructor(public readonly readOnly: boolean) {
        this.client = null;
        this.completed = false;
    }

    private async init(): Promise<void> {
        this.client = await DB.getClient();

        if (!this.readOnly) {
            await DB.beginTransaction(this.client);
        }
    }

    public async query(sql: string, params: any[] = []): Promise<pg.QueryResult> {
        if (!this.client) {
            throw new Error('db client not initialized');
        }

        return this.client.query(sql, params);
    }

    public async getLastInsertId(table: string, idColumn: string): Promise<number> {
        const result = await this.query('SELECT currval(pg_get_serial_sequence($1, $2)) as id', [table, idColumn]);
        return parseInt(result.rows[0].id);
    }

    public async complete(commit: boolean | null = null): Promise<void> {
        if (this.completed || !this.client) {
            return;
        }

        this.completed = true;

        try {
            if (commit !== null) {
                await (
                    commit
                        ? DB.commitTransaction(this.client)
                        : DB.rollbackTransaction(this.client)
                );
            } else if (!this.readOnly) {
                throw new Error('transaction has been opened, requires information if commit or rollback needed');
            }
        } finally {
            this.client.release();
            this.client = null;
        }
    }

    public static async create(readOnly: boolean): Promise<DbSession> {
        const unit = new DbSession(readOnly);
        await unit.init();
        return unit;
    }

    public static async ensureTablesCreated(): Promise<void> {
        const dbSession = await DbSession.create(false);

        try {
            const statements = [
                `CREATE TABLE IF NOT EXISTS account (
                    uid SERIAL PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    display_name VARCHAR(255),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    shadow_mode BOOLEAN NOT NULL DEFAULT FALSE,
                    full_name_search BOOLEAN NOT NULL DEFAULT FALSE,
                    private_key VARCHAR(5000),
                    public_key VARCHAR(5000)
                )`,
                `CREATE TABLE IF NOT EXISTS message (
                    mid SERIAL PRIMARY KEY,
                    sender_uid INTEGER NOT NULL,
                    receiver_uid INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    nonce VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sender_uid) REFERENCES account(uid),
                    FOREIGN KEY (receiver_uid) REFERENCES account(uid)
                )`,
                `CREATE TABLE IF NOT EXISTS contact (
                    contact_id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    contact_user_id INTEGER NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'incoming_request',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES account(uid),
                    FOREIGN KEY (contact_user_id) REFERENCES account(uid),
                    UNIQUE (user_id, contact_user_id),
                    CHECK (status IN ('incoming_request', 'outgoing_request', 'accepted', 'rejected', 'blocked', 'deleted'))
                )`,
                `CREATE TABLE IF NOT EXISTS decrypted_messages(
                    mid SERIAL PRIMARY KEY,
                    sender_uid INTEGER NOT NULL,
                    receiver_uid INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sender_uid) REFERENCES account(uid),
                    FOREIGN KEY (receiver_uid) REFERENCES account(uid)
                )`
            ];

            for (const statement of statements) {
                await dbSession.query(statement);
            }
            await dbSession.complete(true);
        } catch (error) {
            await dbSession.complete(false);
            throw new Error(`failed creating tables: ${error}`);
        }
    }
}

class DB {
    private static pool: pg.Pool | null = null;

    public static getPool(): pg.Pool {
        if (!DB.pool) {
            DB.pool = new pg.Pool(dbConfig);
        }

        return DB.pool;
    }

    public static async getClient(): Promise<pg.PoolClient> {
        return await DB.getPool().connect();
    }

    public static async beginTransaction(client: pg.PoolClient): Promise<void> {
        await client.query('BEGIN');
    }

    public static async commitTransaction(client: pg.PoolClient): Promise<void> {
        await client.query('COMMIT');
    }

    public static async rollbackTransaction(client: pg.PoolClient): Promise<void> {
        await client.query('ROLLBACK');
    }
}
