import { Client } from 'pg';
import inquirer from 'inquirer';
import { ConsistentHashing } from '../ConsistentHashing';

interface ShardConnection {
    master: Client;
    replica: Client;
}

let shardDBs: Record<string, ShardConnection> = {
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
        try {
            await shard.master.connect();
            await shard.replica.connect();
            await shard.master.query(TABLE_SCHEMA);
            await shard.replica.query(TABLE_SCHEMA);
            console.log(`Initialized ${shardName}`);
        } catch (error) {
            console.error(`Failed to initialize ${shardName}:`, error);
        }
    }
}

async function insertUser(username: string) {
    const shard = ConsistentHashing.getShardByKey(username);
    const db = shardDBs[shard.name];

    if (!db) {
        console.error(`Shard ${shard.name} not found in database connections`);
        return;
    }

    try {
        await db.master.query('INSERT INTO users (username) VALUES ($1)', [username]);
        await db.replica.query('INSERT INTO users (username) VALUES ($1)', [username]);
        console.log(`Inserted "${username}" to ${shard.name} master and replicated.`);
    } catch (error) {
        console.error(`Failed to insert user "${username}":`, error);
    }
}

async function readUser(username: string) {
    const shard = ConsistentHashing.getShardByKey(username);
    const db = shardDBs[shard.name];

    if (!db) {
        console.error(`Shard ${shard.name} not found in database connections`);
        return;
    }

    try {
        const res = await db.replica.query('SELECT * FROM users WHERE username = $1', [username]);
        console.log(`Read from ${shard.name} replica for "${username}":`, res.rows);
    } catch (error) {
        console.error(`Failed to read user "${username}":`, error);
    }
}

async function addShardInteractive() {
    console.log('\nCurrent Shard Weights:');
    const currentStats = ConsistentHashing.getShardStats();
    const totalWeight = currentStats.reduce((sum, stat) => sum + stat.weight, 0);
    
    currentStats.forEach(stat => {
        console.log(`      ${stat.name}: ${stat.weight}%`);
    });
    console.log(`  Total: ${totalWeight}%\n`);

    const answers = await inquirer.prompt([
        { 
            type: 'input', 
            name: 'name', 
            message: 'Enter shard name to add (e.g. shard5):',
            validate: (input) => {
                if (!input.trim()) return 'Shard name cannot be empty';
                if (shardDBs[input.trim()]) return 'Shard already exists';
                return true;
            }
        },
        { 
            type: 'number', 
            name: 'weight', 
            message: 'Enter desired weight for the new shard (1-100):',
            default: 25,
            validate: (input) => {
                //@ts-ignore
                if (input < 1 || input > 100) return 'Weight must be between 1 and 100';
                return true;
            }
        },
        {
            type: 'confirm',
            name: 'confirm',
            message: (answers) => `This will adjust existing shard weights to accommodate ${answers.weight}%. Continue?`,
            default: true
        }
    ]);

    if (!answers.confirm) {
        console.log('Shard addition cancelled');
        return;
    }

    try {
        console.log(`🚀 Adding shard ${answers.name} with weight ${answers.weight}%...`);
        await ConsistentHashing.addShard(answers.name, answers.weight);
        const containerPorts = ConsistentHashing.getContainerPorts();
        const masterContainer = `${answers.name}_master`;
        const replicaContainer = `${answers.name}_replica`;
        
        const masterPort = containerPorts.get(masterContainer);
        const replicaPort = containerPorts.get(replicaContainer);
        
        if (!masterPort || !replicaPort) {
            throw new Error(`Failed to get ports for ${answers.name} containers`);
        }
        shardDBs[answers.name] = {
            master: new Client({ 
                port: masterPort, 
                user: 'postgres', 
                password: 'password', 
                database: 'postgres',
                host: 'localhost'
            }),
            replica: new Client({ 
                port: replicaPort, 
                user: 'postgres', 
                password: 'password', 
                database: 'postgres',
                host: 'localhost'
            })
        };

        await shardDBs[answers.name].master.connect();
        await shardDBs[answers.name].replica.connect();
        
        console.log(`Shard ${answers.name} added successfully and connected to databases`);
        console.log('\nUpdated Ring Distribution:');
        displayRingStats();
        
    } catch (error) {
        console.error(`Failed to add shard ${answers.name}:`, error);
    }
}

async function removeShardInteractive() {
    const currentShards = Object.keys(shardDBs);
    
    if (currentShards.length === 0) {
        console.log('No shards available to remove');
        return;
    }

    const answers = await inquirer.prompt([
        { 
            type: 'list',
            name: 'name',
            message: 'Select shard to remove:',
            choices: currentShards
        },
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to remove this shard? This will delete all data!',
            default: false
        }
    ]);

    if (!answers.confirm) {
        console.log('Shard removal cancelled');
        return;
    }

    try {
        if (shardDBs[answers.name]) {
            await shardDBs[answers.name].master.end();
            await shardDBs[answers.name].replica.end();
            delete shardDBs[answers.name];
        }
        await ConsistentHashing.removeShard(answers.name);
        
        console.log(`Shard ${answers.name} removed successfully`);
        
        console.log('\nUpdated Ring Distribution:');
        displayRingStats();
        
    } catch (error) {
        console.error(`Failed to remove shard ${answers.name}:`, error);
    }
}

async function rebalanceWeightsInteractive() {
    const currentStats = ConsistentHashing.getShardStats();
    
    console.log('\nCurrent Shard Weights:');
    currentStats.forEach(stat => {
        console.log(`  ${stat.name}: ${stat.weight}%`);
    });
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Rebalance weights equally among ${currentStats.length} shards?`,
            default: false
        }
    ]);
    
    if (!confirm) {
        console.log('Rebalancing cancelled');
        return;
    }
    
    try {
        ConsistentHashing.rebalanceWeights();
        console.log('\nUpdated Ring Distribution:');
        displayRingStats();
    } catch (error) {
        console.error('Failed to rebalance weights:', error);
    }
}

function displayRingDistribution() {
    const distribution = ConsistentHashing.getRingDistribution();
    console.log('\nRing Distribution:');
    console.log('Hash Range -> Shard Mapping:');
    
    const sortedEntries = Array.from(distribution.entries()).sort((a, b) => a[0] - b[0]);
    
    for (const [hash, shard] of sortedEntries) {
        console.log(`  ${hash.toString().padStart(10)} => ${shard}`);
    }
}

function displayRingStats() {
    const stats = ConsistentHashing.getShardStats();
    console.log('\nShard Statistics:');
    console.log('Name'.padEnd(15) + 'Weight'.padEnd(10) + 'Virtual Nodes');
    console.log('-'.repeat(40));
    
    for (const stat of stats) {
        console.log(
            stat.name.padEnd(15) + 
            `${stat.weight}%`.padEnd(10) + 
            stat.virtualNodes
        );
    }
    
    const totalWeight = stats.reduce((sum, stat) => sum + stat.weight, 0);
    console.log('-'.repeat(40));
    console.log(`Total Weight: ${totalWeight}%`);
    
    if (totalWeight !== 100) {
        console.warn('Warning: Total weight does not equal 100%');
    }
}

async function listAllUsers() {
    console.log('\nAll Users across all shards:');
    
    for (const shardName in shardDBs) {
        const shard = shardDBs[shardName];
        try {
            const res = await shard.replica.query('SELECT * FROM users ORDER BY user_id');
            console.log(`\n${shardName}:`);
            if (res.rows.length === 0) {
                console.log('  (no users)');
            } else {
                res.rows.forEach(row => {
                    console.log(`  ${row.user_id}: ${row.username}`);
                });
            }
        } catch (error) {
            console.error(`Failed to query ${shardName}:`, error);
        }
    }
}

async function migrateData() {
    console.log('\nStarting data migration...');
    
    const allUsers: { username: string, currentShard: string }[] = [];
    
    for (const shardName in shardDBs) {
        const shard = shardDBs[shardName];
        try {
            const res = await shard.replica.query('SELECT username FROM users');
            res.rows.forEach(row => {
                allUsers.push({ username: row.username, currentShard: shardName });
            });
        } catch (error) {
            console.error(`Failed to get users from ${shardName}:`, error);
        }
    }
    
    console.log(`Found ${allUsers.length} users to potentially migrate`);
    
    let migrated = 0;
    for (const user of allUsers) {
        const correctShard = ConsistentHashing.getShardByKey(user.username);
        
        if (correctShard.name !== user.currentShard) {
            try {
                await shardDBs[user.currentShard].master.query('DELETE FROM users WHERE username = $1', [user.username]);
                await shardDBs[user.currentShard].replica.query('DELETE FROM users WHERE username = $1', [user.username]);
                
                await shardDBs[correctShard.name].master.query('INSERT INTO users (username) VALUES ($1)', [user.username]);
                await shardDBs[correctShard.name].replica.query('INSERT INTO users (username) VALUES ($1)', [user.username]);
                
                console.log(`Migrated "${user.username}" from ${user.currentShard} to ${correctShard.name}`);
                migrated++;
            } catch (error) {
                console.error(`Failed to migrate "${user.username}":`, error);
            }
        }
    }
    console.log(`Migration complete! ${migrated} users migrated.`);
}

async function closeAllConnections() {
    for (const shardName in shardDBs) {
        const shard = shardDBs[shardName];
        try {
            await shard.master.end();
            await shard.replica.end();
        } catch (error) {
            console.error(`Error closing connections for ${shardName}:`, error);
        }
    }
    console.log('All database connections closed.');
}

async function mainMenu() {
    const options = [
        'Insert User',
        'Read User',
        'List All Users',
        'Add Shard',
        'Remove Shard',
        'Rebalance Weights',
        'View Ring Distribution',
        'View Shard Statistics',
        'Migrate Data',
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

            case 'List All Users':
                await listAllUsers();
                break;

            case 'Add Shard':
                await addShardInteractive();
                break;

            case 'Remove Shard':
                await removeShardInteractive();
                break;

            case 'Rebalance Weights':
                await rebalanceWeightsInteractive();
                break;

            case 'View Ring Distribution':
                displayRingDistribution();
                break;

            case 'View Shard Statistics':
                displayRingStats();
                break;

            case 'Migrate Data':
                await migrateData();
                break;

            case 'Exit':
                await closeAllConnections();
                await ConsistentHashing.cleanup();
                console.log('Exiting...');
                process.exit(0);
        }
    }
}

async function start() {
    console.log('Starting Consistent Hashing CLI...');
    await connectAndInitializeDBs();
    await mainMenu();
}

start().catch(err => {
    console.error('Error:', err);
    closeAllConnections()
        .then(() => ConsistentHashing.cleanup())
        .finally(() => process.exit(1));
});