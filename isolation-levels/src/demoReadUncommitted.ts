import { pool } from "./db";
/**
 * Simulated Read Uncommitted Demo
 * PostgreSQL does NOT allow dirty reads, even if we request "READ UNCOMMITTED".
 * It treats it as READ COMMITTED internally.
 * This demo shows that uncommitted data from one transaction is NOT visible in another.
 */

export async function demoReadUncommitted() {
    console.log('\n Read uncommitted demo (PostgreSQL treats it as Read Committed');
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
        await client1.query('BEGIN ISOLATION LEVEL READ UNCOMMITTED');
        await client1.query(`INSERT INTO accounts(name, balance) VALUES ('temp_user', '999')`);
        console.log('Transaction 1: Inserted temp_user (not committed');
        
        await client2.query(`BEGIN ISOLATION LEVEL READ UNCOMMITTED`);
        const result = await client2.query(`SELECT * FROM accounts WHERE name = 'temp_user'`);
        console.log(`Transaction 2: Can it see uncommitted row from Transaction 1 ?`, result.rows.length > 0 ? 'YES (unexpected)': 'NO(expected)');
        await client2.query('COMMIT');
        await client1.query('ROLLBACK')
        
    } catch (error) {
        console.log('Error occured in processing transactions');
        console.log(error);
    } finally {
        client1.release();
        client2.release();
    }
}