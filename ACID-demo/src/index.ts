import { pool, initSchema } from "./db";

async function demonstrateAtomicity() {
  console.log('\n== Atomicity Demo ==');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO users(username) VALUES($1)`, ['alice']);
    await client.query(`INSERT INTO users(username) VALUES($1)`, ['alice']);
    await client.query('COMMIT');
  } catch (err: any) {
    console.log('Error occurred, rolling back:', err.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const res = await pool.query(`SELECT * FROM users WHERE username = 'alice'`);
  console.log('Users named alice after transaction:', res.rows);
}

async function demonstrateConsistency() {
  console.log('\n== Consistency Demo ==');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO posts(user_id, content) VALUES($1, $2)`, [999, 'Ghost post']);
    await client.query('COMMIT');
  } catch (err: any) {
    console.log('FK constraint violation, rolled back:', err.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const res = await pool.query(`SELECT * FROM posts`);
  console.log('Posts table contents:', res.rows);
}

async function demonstrateIsolation() {
  console.log('\n== Isolation Demo ==');
  const client1 = await pool.connect();
  const client2 = await pool.connect();

  try {
    await client1.query('BEGIN');
    await client1.query(`INSERT INTO users(username) VALUES($1)`, ['bob']);
    console.log('Txn1: inserted bob but not yet committed');

    await client2.query('BEGIN');
    const readBeforeCommit = await client2.query(`SELECT * FROM users WHERE username='bob'`);
    console.log('Txn2 sees bob before commit?', readBeforeCommit.rows.length > 0);

    await client1.query('COMMIT');
    console.log('Txn1: committed bob');

    const readAfterCommit = await client2.query(`SELECT * FROM users WHERE username='bob'`);
    console.log('Txn2 sees bob after commit?', readAfterCommit.rows.length > 0);

    await client2.query('COMMIT');
  } catch (err) {
    console.error('Isolation demo error:', err);
    await client1.query('ROLLBACK');
    await client2.query('ROLLBACK');
  } finally {
    client1.release();
    client2.release();
  }
}

async function demonstrateDurability() {
  console.log('\n== Durability Demo ==');
  await pool.query(`INSERT INTO users(username) VALUES($1)`, ['carol']);
  console.log('Inserted carol and committed. Now restart the DB to test durability.');
  console.log('After restart, run SELECT * FROM users to see carol still there.');
}

async function main() {
  await initSchema();
  await demonstrateAtomicity();
  await demonstrateConsistency();
  await demonstrateIsolation();
  await demonstrateDurability();
  console.log('\nAll demos done. To verify durability, restart the Docker DB and rerun a simple SELECT.');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
