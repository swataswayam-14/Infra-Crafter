import { Pool } from "pg";

export const pool = new Pool({
    user:'swayam',
    host: 'localhost',
    database: 'steguf',
    password:'paplu',
    port: 5432,
})

export async function initSchema(){
    await pool.query(`DROP TABLE IF EXISTS accounts`);
    await pool.query(`
        CREATE TABLE accounts (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50),
            balance INT
        );
    `);
    await pool.query(`INSERT INTO accounts (name, balance) VALUES ('swayam', 1000), ('shivam', 1000)`);
}