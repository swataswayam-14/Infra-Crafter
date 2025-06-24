import { pool } from "./db";

export async function demoRepeatableRead(){
    console.log('\n Repeatable Read Demo');
    
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
        await client1.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        const balance1 = await client1.query(`SELECT balance FROM accounts WHERE name = 'swayam'`);
        console.log(`Txn1 (initial read): Swayam = ${balance1.rows[0].balance}`);
        await client2.query('BEGIN');
        await client2.query(`UPDATE accounts SET balance = balance - 200 WHERE name = 'swayam'`);
        await client2.query('COMMIT');
        const balance2 = await client1.query(`SELECT balance FROM accounts WHERE name = 'swayam'`);
        console.log(`Txn1 (re-read) after Txn2 commit , Swayam = ${balance2.rows[0].balance} (should be same)`);
        await client1.query('COMMIT');
    } catch (error) {
        console.log('Error processing transactions');
        console.log(error);
    } finally{
        client1.release();
        client2.release();
    }
}