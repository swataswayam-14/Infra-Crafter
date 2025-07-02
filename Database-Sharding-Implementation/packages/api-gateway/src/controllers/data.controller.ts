import { Request, Response } from "express";
import logger from "../utils/logger";
import { partitions } from "../config/shardConfig";

export const writeData = async(req: Request, res:Response) => {
    //@ts-ignore
    const {pool, partitionId} = req.shard;
    const {data} = req.body;

    try {
        const startTime = Date.now();
        const query = partitions.find(p => p.id = partitionId)?.routingStrategy === 'horizontal' ? 'INSERT INTO data (id, content, shard_key) VALUES ($1, $2, $3)' : 'INSERT INTO data (id, content) VALUES ($1, $2)';

        const params = partitions.find( p => p.id === partitionId)?.routingStrategy === 'horizontal'? [data.id, data.content, data.shardKey || data.id] : [data.id, data.content];

        await pool.query(query, params);
        const latency = Date.now() - startTime;

        logger.info(`Write to partition ${partitionId} completed in ${latency}ms`);

        return res.status(201).json({
            success: true,
            partitionId,
            //@ts-ignore
            shardId: req.shard.id,
            latency,
        });
    } catch (error) {
        logger.error({error}, `Write error to partition ${partitionId}`);
        return res.status(500).json({
            error: 'Failed to write data'
        });
    }
}

export const readData = async(req:Request, res:Response) => {
    //@ts-ignore
    const {pool, partitionId, isReplica} = req.shard;
    const {id} = req.params;

    try {
        const startTime = Date.now();
        const query = partitions.find(p => p.id === partitionId)?.routingStrategy === 'horizontal' ? 'SELECT * FROM data WHERE id = $1 AND shard_key = $2' : 'SELECT * FROM data WHERE id = $1';

        const params = partitions.find( p=> p.id === partitionId)?.routingStrategy === 'horizontal' ? [id, req.query.shard_key || id] : [id];

        const result = await pool.query(query, params);
        const latency = Date.now() - startTime;
        logger.info(`Read from ${isReplica? 'replica': 'primary'} of partition ${partitionId} completed in ${latency}ms`);

        if(result.rows.length === 0) {return res.status(404).json({
            error: 'Data not found'
        })} else {
            return res.status(200).json({
                data: result.rows[0],
                partitionId,
                //@ts-ignore
                shardId: req.shard.id,
                isReplica,
                latency
            })
        }
    } catch (error) {
        logger.error({error},`Read error from partition ${partitionId}`)
        return res.status(500).json({
            error: 'Failed to read data'
        })
    }
}

export const batchWrite = async (req:Request, res:Response) => {
    //@ts-ignore
    const {pool, partitionId} = req.shard;
    const {batch} = req.body;

    if(!Array.isArray(batch)) {
        return res.status(400).json({
            error: 'Batch must be an array'
        });
    }

    try {
        const startTime = Date.now();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            const isHorizontal = partitions.find(p => p.id === partitionId)?.routingStrategy === 'horizontal';
            const query = isHorizontal
                ? 'INSERT INTO data (id, content, shard_key) VALUES ($1, $2, $3)'
                : 'INSERT INTO data (id, content) VALUES ($1, $2)';
            for (const item of batch) {
                const params = isHorizontal ? [item.id, item.content, item.shardKey || item.id] : [item.id, item.content];
        
                await client.query(query, params);
            }
            await client.query('COMMIT');
            const latency = Date.now() - startTime;
            const throughput = batch.length / (latency / 1000);
      
            logger.info(`Batch write of ${batch.length} items to partition ${partitionId} completed in ${latency}ms (${throughput.toFixed(2)} ops/s)`);
            return res.status(201).json({
                success: true,
                count: batch.length,
                partitionId,
                //@ts-ignore
                shardId: req.shard.id,
                latency,
                throughput,
            });
        } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({err}, `Batch write error to partition ${partitionId}: ${err}`);
    return res.status(500).json({ error: 'Failed to write batch', details: err.message });
  }
};