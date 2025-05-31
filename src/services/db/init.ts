import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector'; // Include vector extension
import dbSchemaSql from './schema.sql?raw'; // Adjusted path to schema.sql in the same directory

console.log('[DB Init] Module loaded.');

let db: PGlite | null = null;
// Promise resolves to the *initialized* instance, or rejects on error.
let dbReadyPromise: Promise<PGlite> | null = null;

// Add instance tracking for debugging
let instanceCounter = 0;
const instanceTracker = new Map<number, { created: Date; status: string }>();

// Starts initialization if needed, sets the promise, but doesn't assign 'db' here.
// Returns the promise representing the ongoing or completed initialization.
function startInitialization(): Promise<PGlite> {
    const currentInstanceId = ++instanceCounter;
    console.log(`[DB startInitialization] Starting NEW PGlite initialization... Instance ID: ${currentInstanceId}`);
    instanceTracker.set(currentInstanceId, { created: new Date(), status: 'initializing' });
    
    return (async () => {
        try {
            console.log(`[DB startInitialization ${currentInstanceId}] Creating PGlite instance with IDB path: idb://scarlett-wxt-db`);
            const instance = new PGlite('idb://scarlett-wxt-db', { extensions: { vector } });
            instanceTracker.set(currentInstanceId, { created: new Date(), status: 'created_awaiting_ready' });
            
            console.log(`[DB startInitialization ${currentInstanceId}] PGlite instance created, awaiting ready...`);
            await instance.waitReady;
            console.log(`[DB startInitialization ${currentInstanceId}] PGlite instance ready.`);
            instanceTracker.set(currentInstanceId, { created: new Date(), status: 'ready' });

            // --- Apply Schema --- 
            console.log(`[DB startInitialization ${currentInstanceId}] Applying database schema START...`);
            try {
                // ALWAYS execute the full schema.
                // CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS statements
                // in schema.sql will handle idempotency.
                console.log(`[DB startInitialization ${currentInstanceId}] Executing full schema from schema.sql...`);
                await instance.exec(dbSchemaSql);
                console.log(`[DB startInitialization ${currentInstanceId}] --- FULL SCHEMA EXECUTION COMPLETE ---`);

                // Optional: Add a verification step for a newly added table to confirm, e.g., daily_study_stats
                const verifyDailyStatsSql = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_study_stats');`;
                const verifyResult = await instance.query<{ exists: boolean }>(verifyDailyStatsSql);
                console.log(`[DB startInitialization ${currentInstanceId}] Verification result: daily_study_stats table exists = ${verifyResult?.rows?.[0]?.exists}`);

                // DEBUG: Check if ai_personality table exists and has data
                const personalityTableCheck = await instance.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_personality');`);
                const personalityTableExists = (personalityTableCheck.rows[0] as any)?.exists;
                console.log(`[DB startInitialization ${currentInstanceId}] ai_personality table exists: ${personalityTableExists}`);
                
                if (personalityTableExists) {
                    const personalityCountResult = await instance.query('SELECT COUNT(*) as count FROM ai_personality');
                    const personalityCount = (personalityCountResult.rows[0] as any)?.count || 0;
                    console.log(`[DB startInitialization ${currentInstanceId}] ai_personality table has ${personalityCount} rows`);
                } else {
                    console.log(`[DB startInitialization ${currentInstanceId}] ai_personality table does not exist yet`);
                }

                console.log(`[DB startInitialization ${currentInstanceId}] Applying database schema COMPLETE.`);
                instanceTracker.set(currentInstanceId, { created: new Date(), status: 'schema_applied' });
            } catch (schemaError) {
                console.error(`[DB startInitialization ${currentInstanceId}] Error during schema check/application:`, schemaError);
                instanceTracker.set(currentInstanceId, { created: new Date(), status: 'schema_failed' });
                throw schemaError; 
            }
            // --- END Schema --- 

            // --- DO NOT SEED HERE --- 

            console.log(`[DB startInitialization ${currentInstanceId}] Initialization complete (Schema applied). Assigning instance to 'db'.`);
            
            // DEBUG: Log previous db instance if it exists
            if (db) {
                console.warn(`[DB startInitialization ${currentInstanceId}] WARNING: Replacing existing db instance! Previous instance was active.`);
            }
            
            db = instance; // Assign db instance
            instanceTracker.set(currentInstanceId, { created: new Date(), status: 'assigned_to_global' });
            
            console.log(`[DB startInitialization ${currentInstanceId}] Instance tracker status:`, Array.from(instanceTracker.entries()));
            
            return db; // Resolve the promise
        } catch (error) {
            console.error(`[DB startInitialization ${currentInstanceId}] PGlite initialization or schema application failed:`, error);
            instanceTracker.set(currentInstanceId, { created: new Date(), status: 'failed' });
            dbReadyPromise = null; 
            db = null; 
            throw error; // Reject the promise
        }
    })();
}

// Exported function to trigger initialization if needed (e.g., explicitly from background)
// Ensures the promise is created but doesn't necessarily wait here.
export function ensureDbInitialized(): Promise<PGlite> {
    if (!dbReadyPromise) {
        console.log('[DB ensureDbInitialized] No promise found. Starting initialization.');
        console.log(`[DB ensureDbInitialized] Current instance tracker:`, Array.from(instanceTracker.entries()));
        dbReadyPromise = startInitialization();
    } else {
        console.log('[DB ensureDbInitialized] Initialization promise already exists.');
        console.log(`[DB ensureDbInitialized] Current instance tracker:`, Array.from(instanceTracker.entries()));
    }
    return dbReadyPromise;
}


// Gets the instance, ALWAYS waiting for the current initialization promise.
export async function getDbInstance(): Promise<PGlite> {
    // If the promise doesn't exist yet (e.g., worker just restarted and background didn't call ensureDbInitialized yet)
    // create it by calling ensureDbInitialized.
    if (!dbReadyPromise) {
         console.warn('[DB getDbInstance] No promise found! Triggering initialization implicitly via ensureDbInitialized.');
         console.log(`[DB getDbInstance] Current instance tracker before implicit init:`, Array.from(instanceTracker.entries()));
         // This sets dbReadyPromise = startInitialization()
         ensureDbInitialized(); // Don't await here, just ensure the promise is created
    }

    // Now, dbReadyPromise is guaranteed to be non-null (either from background or implicitly set above).
    // Await the promise. This ensures we wait for the *current* initialization to complete fully
    // (including schema and assignment to 'db') before proceeding.
    try {
        // Important: Directly await the module-level promise variable,
        // which might have been set by ensureDbInitialized just above or earlier.
        const instance = await dbReadyPromise!; // Use non-null assertion as we ensured it's set
        
        // Double check 'db' variable after awaiting. It *should* be set by startInitialization on success.
        if (!db) {
             console.error("[DB getDbInstance] CRITICAL ERROR: dbReadyPromise resolved but 'db' variable is still null! Returning instance from promise directly.");
             // If db is null, something went wrong with the assignment logic in startInitialization,
             // but the promise did resolve, so return the instance we got from it.
             return instance;
        }
        
        // Verify the returned instance is the same as the global db
        if (db !== instance) {
            console.warn("[DB getDbInstance] WARNING: Global 'db' variable differs from promise-resolved instance!");
        }
        
        // If db is set, return it (this is the expected success path).
        return db;
    } catch (error) {
         console.error('[DB getDbInstance] dbReadyPromise rejected. Resetting state and rethrowing error.', error);
         // Ensure state is reset if promise fails during await
         dbReadyPromise = null;
         db = null;
         throw error; // Propagate the error
    }
}
