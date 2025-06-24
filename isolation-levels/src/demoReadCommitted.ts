import { pool } from "./db";
export async function demoReadCommitted(){
    console.log('\n Read Commited Demo');

    const client1 = await pool.connect();
    const client2 = await pool.connect();
    
    try {
        await client1.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        const balanceBefore = await client1.query(`SELECT balance FROM accounts WHERE name = 'swayam'`);
        console.log(`Txn1 (before update): Swayam's balance is ${balanceBefore.rows[0].balance}`);

        await client2.query('BEGIN');
        await client2.query(`UPDATE accounts SET balance = balance - 100 WHERE name = 'swayam'`);
        await client2.query('COMMIT');

        const balanceAfter = await client1.query(`SELECT balance FROM accounts WHERE name = 'swayam'`);
        console.log(`Txn1 (after Txn 2 commit), Swayam's balance = ${balanceAfter.rows[0].balance}`);
        await client1.query('COMMIT');
        
    } catch (error) {
        console.log('Error processing transactions');
    } finally {
        client1.release();
        client2.release();
    }
}