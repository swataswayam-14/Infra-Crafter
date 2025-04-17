import constants from 'node:constants';
import {Pool} from 'pg';

export const pool = new Pool({
    host : 'localhost',
    port: 5432,
    user: 'swayam',
    password: 'paplu',
    database: 'steguf'
});
export async function initSchema(){
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            DROP TABLE IF EXISTS posts, profiles, users;
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL
            );
            CREATE TABLE profiles (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                bio TEXT
            );
            CREATE TABLE posts (
                id SERIAL PRIMARY KEY,
                user_id  INT REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL
            ); 
        `);
        await client.query('COMMIT');
        console.log('Schema initialized');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing schema: ', error);
    } finally {
        client.release();
    }
}