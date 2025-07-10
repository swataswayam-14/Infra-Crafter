import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { DatabaseManager } from "./config/database";
import { ShardManager } from "./services/shard-manager";
import { RouterService } from "./services/router";
import { AnalyticsService } from "./services/analytics";
import { createRoutes } from "./api/routes";

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({
    limit: '10mb'
}));
app.use(express.urlencoded({
    extended: true
}));

const dbManager = new DatabaseManager();
const analytics = new AnalyticsService();
const shardManager = new ShardManager(dbManager, analytics);
const routerService = new RouterService(shardManager);

app.use('/api', createRoutes(routerService, analytics));

app.listen(port, () => {
    console.log('server started at port: ', port);
    console.log(`Analytics: http://localhost:${port}/api/analytics/metrics`);
    console.log(`Health check: http://localhost:${port}/api/health`);
});

process.on('SIGTERM', async() => {
    console.log('gracefull shutdown initiated...');
    await dbManager.closeAll();
    process.exit(0);
})