import { pool, initSchema } from "./db";




/**
 * Demonstrates Atomicity:
 * Ensures that either all operations in a transaction succeed or none do.
 * In this case, trying to insert a duplicate username will violate a constraint
 * and cause the entire transaction to rollback — leaving the database unchanged.
 */

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

/**
 * Demonstrates Consistency:
 * Enforces that any transaction brings the database from one valid state to another.
 * This will violate a foreign key constraint — thus rolled back.
 */


async function demonstrateConsistency() {
  console.log('\n== Consistency Demo ==');
  const client = await pool.connect();
  try { // here we are trying to insert a post with a user_id and some content , but it will rollback as there are no user with the user_id = 999 , it violates foreign key constraint
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

/**
 * Demonstrates Isolation:
 * Ensures that concurrent transactions don't interfere with each other.
 * We'll run two parallel transactions — one inserts a row, the other tries to read it.
 * We’ll show that Txn2 can't see uncommitted changes made by Txn1.
 */

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
/**
 * Demonstrates Durability:
 * Once a transaction is committed, it remains so — even after crashes.
 * Here, we insert "carol" and commit. After restarting the DB,
 * we expect "carol" to still be present.
 */

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
