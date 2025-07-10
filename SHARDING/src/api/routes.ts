import { Router } from "express";
import { RouterService } from "../services/router";
import { AnalyticsService } from "../services/analytics";

export function createRoutes(routerService: RouterService, analytics: AnalyticsService): Router {
    const router = Router();

    router.get('/health' , routerService.getSystemHealth);

    router.post('/write', routerService.extractShardKey, routerService.handleWrite);
    router.get('/read', routerService.extractShardKey, routerService.handleRead);

    router.post('/bulk-write', routerService.extractShardKey, async(req, res) => {
        try {
            const {table, records} = req.body;
            const shardKey = req.shardKey;
            if(!table || !Array.isArray(records) || !shardKey) return res.status(400).json({
                error: 'Table records array and shardKey are required'
            });

            const promises = records.map(record => 
                routerService.getShardManager().write({
                    table,
                    data: record,
                    shardKey
                })
            );
            const results = await Promise.all(promises);
            return res.json({
                success: true,
                count: results.length
            })
        } catch (error) {
            console.error('Bulk write error: ' ,error);
            return res.status(500).json({
                error: 'Internal Server Error'
            })
        }
    })

    router.get('/analytics/metrics', (req,res) => {
        const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string): undefined;
        const metrics = analytics.getMetrics(timeRange);
        return res.status(200).json({
            metrics
        })
    })

    router.get('/analytics/errors', (req,res) => {
        const count = req.query.count ? parseInt(req.query.count as string): undefined
        const errors = analytics.getRecentErrors(count);
        return res.status(200).json({
            count
        })
    })
    return router;
}