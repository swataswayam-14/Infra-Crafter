import { pool } from "./db";

export async function demoSerializableWithRetry() {
    console.log('\n Serializable Demo (with automatic retry on conflict');
     
    async function runTransaction(transactionNumber: string, amount: number) {
        let attempts = 0;
        const maxAttempts = 3

        while(attempts < maxAttempts) {
            const client = await pool.connect();
            attempts++;
            try {
                console.log(`${transactionNumber} Attempt ${attempts} - Starting transaction`);
                await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
                const res = await client.query(`SELECT balance FROM accounts WHERE name = 'shivam'`);
                const currBalance = res.rows[0].balance;
                const newbalance = currBalance + amount;
                
                console.log(`${transactionNumber} Shivam's balance: ${currBalance} ===>> ${newbalance}`);
                
                await client.query(`UPDATE accounts SET balance = $1 WHERE name = 'shivam'`, [newbalance])
                await client.query('COMMIT');
                console.log(`${transactionNumber} Transaction Comitted`);
                break;
            } catch (error:any) {
                console.warn(`${transactionNumber} Conflict occurred: ${error}`)
                await client.query('ROLLBACK');
                if(error.code === '40001' && attempts < maxAttempts) {
                    //serialization failure -> retry
                    const backoff = 100*attempts;
                    console.log(`[${transactionNumber} Retrying in ${backoff} ms...\n]`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                } else {
                    console.error(`$[${transactionNumber}] Failed after ${attempts} attempts`);
                    break;
                }
            } finally{
                client.release();
            }
        }
    }
    await Promise.all([
        runTransaction('Txn1', +50),
        runTransaction('Txn2', -50),
    ]);
}