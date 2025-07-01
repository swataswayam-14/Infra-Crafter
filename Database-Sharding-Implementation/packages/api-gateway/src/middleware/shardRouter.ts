import {Request, Response, NextFunction} from 'express';
import {Pool} from 'pg';
import { getShardForPartition, partitions, Shard } from '../config/shardConfig';
import { shards } from '../config/shardConfig';
import logger from '../utils/logger';

const shardPools: Record<number, {primary: Pool; replica?: Pool}> = {};

export const initializeShardPools = () => {
    shards.forEach((shard: Shard) => {
        shardPools[shard.id] = {
            primary: new Pool(shard.primary),
            replica: shard.replica? new Pool(shard.replica): undefined
        };
        shardPools[shard.id].primary.query('SELECT 1').then(() => 
            logger.info(`Connected to primary of shard ${shard.id}`)
        ).catch(err => 
            logger.error({err}, `Error Connecting to primary of shard ${shard.id}`)
        );
        if(shardPools[shard.id].replica) {
            shardPools[shard.id].replica!.query('SELECT 1').then(() =>
            logger.info(`Connected to replicab of shard ${shard.id}`)
        ).catch(err => 
            logger.error({err}, `Error connecting to replica pf shard ${shard.id}`)
        )
        }
    });
}
const determinePartition = (req: Request): string => {
    if(req.query.userId) {
        const userId = req.query.userId as string;
        const hash = userId.split('').reduce((acc, char)=> acc + char.charCodeAt(0), 0);
        const partitionIndex = hash % partitions.filter(p => p.routingStrategy === 'horizontal').length;
        return partitions.filter( p=> p.routingStrategy === 'horizontal')[partitionIndex].id;
    }
    if(req.path.includes('/user')) return 'A';
    if(req.path.includes('/protect')) return 'B';
    if(req.path.includes('/order')) return 'C';
    if(req.path.includes('/payment')) return 'D';
    if(req.path.includes('/inventory')) return 'E';

    return partitions[0].id;
}

export const shardRouter = (req:Request, res:Response, next: NextFunction) => {
    try {
        const partitionId = determinePartition(req);
        const shard = getShardForPartition(partitionId);
//@ts-ignore
        req.shard = {
            id:shard.id,
            partitionId,
            pool: req.method === 'GET' && shard.replica ? shardPools[shard.id].replica! : shardPools[shard.id].primary,
            isReplica : req.method === 'GET' && shard.replica !== undefined
        }
        next();
    } catch (error) {
        logger.error({error}, `Shard routing error`);
        res.status(500).json({
            error: 'Internal Server Error during shard routing'
        })
    }
}