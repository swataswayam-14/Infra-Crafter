import { pool } from "./db";

export async function demoSerializable() {

    console.log('\n Serializable Demo');
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
        await client1.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await client2.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        await client1.query(`UPDATE accounts SET balance = balance + 50 WHERE name = 'swayam'`);
        await client1.query('COMMIT');
        await client2.query(`UPDATE accounts SET balance = balance - 50 WHERE name = 'swayam'`);
        await client2.query('COMMIT');
    } catch (error) {
        console.error('Conflict detected, one transaction rolled back');
        await client1.query('ROLLBACK');
        await client2.query('ROLLBACK');    
    }finally{
        client1.release();
        client2.release();
    }
}