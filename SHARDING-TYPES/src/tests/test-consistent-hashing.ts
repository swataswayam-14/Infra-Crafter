import { Client } from 'pg';
import inquirer from 'inquirer';
import { ConsistentHashing } from '../ConsistentHashing';

interface ShardConnection {
    master: Client;
    replica: Client;
}

const shardDBs: Record<string, ShardConnection> = {
    shard1: {
        master: new Client({ port: 5433, user: 'postgres', password: 'password', database: 'shard1_master' }),
        replica: new Client({ port: 5434, user: 'postgres', password: 'password', database: 'shard1_replica' })
    },
    shard2: {
        master: new Client({ port: 5435, user: 'postgres', password: 'password', database: 'shard2_master' }),
        replica: new Client({ port: 5436, user: 'postgres', password: 'password', database: 'shard2_replica' })
    },
    shard3: {
        master: new Client({ port: 5437, user: 'postgres', password: 'password', database: 'shard3_master' }),
        replica: new Client({ port: 5438, user: 'postgres', password: 'password', database: 'shard3_replica' })
    },
    shard4: {
        master: new Client({ port: 5439, user: 'postgres', password: 'password', database: 'shard4_master' }),
        replica: new Client({ port: 5440, user: 'postgres', password: 'password', database: 'shard4_replica' })
    }
};

const TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL
);
`;

async function connectAndInitializeDBs() {
    console.log('Connecting to all databases and initializing schemas...');
    for (const shardName in shardDBs) {
        const shard = shardDBs[shardName];
        await shard.master.connect();
        await shard.replica.connect();
        await shard.master.query(TABLE_SCHEMA);
        await shard.replica.query(TABLE_SCHEMA);
        console.log(`Initialized ${shardName}`);
    }
}

async function insertUser(username: string) {
    const shard = ConsistentHashing.getShardByKey(username);
    const db = shardDBs[shard.name];

    await db.master.query('INSERT INTO users (username) VALUES ($1)', [username]);
    await db.replica.query('INSERT INTO users (username) VALUES ($1)', [username]);

    console.log(`Inserted "${username}" to ${shard.name} master and replicated.`);
}

async function readUser(username: string) {
    const shard = ConsistentHashing.getShardByKey(username);
    const db = shardDBs[shard.name];

    const res = await db.replica.query('SELECT * FROM users WHERE username = $1', [username]);
    console.log(`Read from ${shard.name} replica for "${username}":`, res.rows);
}


async function removeShardInteractive() {
    const answers = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Shard name to remove (e.g. shard2):' }
    ]);

    ConsistentHashing.removeShard(answers.name);
    console.log(`Shard ${answers.name} removed from the ring.`);
}

async function displayRingDistribution() {
    const distribution = ConsistentHashing.getRingDistribution();
    console.log('Ring Distribution:');
    for (const [hash, shard] of distribution.entries()) {
        console.log(`Hash: ${hash} => Shard: ${shard}`);
    }
}

async function closeAllConnections() {
    for (const shardName in shardDBs) {
        const shard = shardDBs[shardName];
        await shard.master.end();
        await shard.replica.end();
    }
    console.log('All database connections closed.');
}

async function mainMenu() {
    const options = [
        'Insert User',
        'Read User',
        'Remove Shard',
        'View Ring Distribution',
        'Exit'
    ];

    while (true) {
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Choose an operation:',
                choices: options
            }
        ]);

        switch (answer.action) {
            case 'Insert User':
                const { username: insertName } = await inquirer.prompt([
                    { type: 'input', name: 'username', message: 'Enter username to insert:' }
                ]);
                await insertUser(insertName);
                break;

            case 'Read User':
                const { username: readName } = await inquirer.prompt([
                    { type: 'input', name: 'username', message: 'Enter username to read:' }
                ]);
                await readUser(readName);
                break;

            case 'Remove Shard':
                await removeShardInteractive();
                break;

            case 'View Ring Distribution':
                await displayRingDistribution();
                break;

            case 'Exit':
                await closeAllConnections();
                console.log('👋 Exiting...');
                process.exit(0);
        }
    }
}

async function start() {
    await connectAndInitializeDBs();
    await mainMenu();
}

start().catch(err => {
    console.error('Error:', err);
    closeAllConnections().finally(() => process.exit(1));
});
