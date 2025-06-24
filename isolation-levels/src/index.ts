import { initSchema } from "./db";
import { demoReadCommitted } from "./demoReadCommitted";
import { demoReadUncommitted } from "./demoReadUncommitted";
import { demoRepeatableRead } from "./demoRepeatableReads";
import { demoSerializable } from "./demoSerializable";
import { demoSerializableWithRetry } from "./demoSerializableWithRetry";

async function main() {
    await initSchema();
    await demoReadUncommitted();
    await demoReadCommitted();
    await demoRepeatableRead();
    await demoSerializable();
    await demoSerializableWithRetry();
    process.exit(0);
}

main();