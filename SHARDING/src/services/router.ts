import {Request, Response, NextFunction} from 'express';
import { ShardManager } from './shard-manager';

export class RouterService {
    private shardManager: ShardManager;

    constructor(shardManager: ShardManager) {
        this.shardManager = shardManager;
    }
    extractShardKey = (req:Request, res:Response, next: NextFunction) => {
        const shardKey = req.headers['x-shard-key'] as string || req.query.shardKey as string || req.body?.shardKey;
        if(!shardKey) return res.status(400).json({
            error: 'Shard key is required'
        })
        req.shardKey = shardKey;
        next();
    }

    handleWrite = async(req:Request, res:Response) => {
        try {
            const {table, data, shardKey} = req.body;
            if(!table || !data || !shardKey) return res.status(400).json({
                error: 'Table, data and shardKey are required'
            });
            const result = await this.shardManager.write({
                table,
                data,
                shardKey 
            })
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Write error:', error);
            res.status(500).json({
                error: 'Internal server error'
            })
        }
    }

    handleRead = async (req:Request, res:Response) => {
        try {
            const {table, where, orderBy, limit} = req.query;

            if(!table) return res.status(400).json({
                error: 'Table is required'
            })
            let query = `SELECT * FROM ${table}`;
            const params: any[] = [];
            if(where) {
                query += ` WHERE ${where}`;
            }
            if(orderBy) {
                query += ` ORDER BY ${orderBy}`;
            }
            if(limit) {
                query += ` LIMIT ${limit}`
            }

            const result = await this.shardManager.read({
                table: table as string,
                query,
                params,
                shardKey: req.shardKey
            });
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Read Error: ', error);
            return res.status(500).json({
                error: 'Internal Server Error'
            })
        }
    }
    getSystemHealth = async(req: Request, res:Response) => {
        try {
            const health = await this.shardManager.getShardHealth();
            return res.json({
                success: true,
                health
            });
        } catch (error) {
            console.error('Health check error', error);
            return res.status(500).json({
                error: 'Internal Server Error'
            })
        }
    }
}