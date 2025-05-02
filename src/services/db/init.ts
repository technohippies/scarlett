import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector'; // Include vector extension
import dbSchemaSql from './schema.sql?raw'; // Adjusted path to schema.sql in the same directory

console.log('[DB Init] Module loaded.');

let db: PGlite | null = null;
// Promise resolves to the *initialized* instance, or rejects on error.
let dbReadyPromise: Promise<PGlite> | null = null;

// Starts initialization if needed, sets the promise, but doesn't assign 'db' here.
// Returns the promise representing the ongoing or completed initialization.
function startInitialization(): Promise<PGlite> {
    console.log('[DB startInitialization] Starting NEW PGlite initialization...');
    // Return the promise immediately. The assignment happens inside.
    return (async () => {
        try {
            const instance = new PGlite('idb://scarlett-wxt-db', { extensions: { vector } });
            console.log("[DB startInitialization] PGlite instance created, awaiting ready...");
            await instance.waitReady;
            console.log('[DB startInitialization] PGlite instance ready.');

            // --- Apply Schema ---
            console.log('[DB startInitialization] Applying database schema START...');
            try {
                // Check if the NEW chat_threads table exists
                const checkSql = `
                  SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'chat_threads'
                  );
                `;
                console.log('[DB startInitialization] Executing check query:', checkSql);
                const checkResult = await instance.query<{ exists: boolean }>(checkSql);
                const tableExists = checkResult?.rows?.[0]?.exists;
                console.log(`[DB startInitialization] Check query result: chat_threads exists = ${tableExists}`);

                if (tableExists === false) {
                    console.log('[DB startInitialization] chat_threads table does not exist. Applying full schema...');
                    console.log('[DB startInitialization] --- EXECUTING FULL SCHEMA ---');
                    await instance.exec(dbSchemaSql);
                    console.log('[DB startInitialization] --- FULL SCHEMA EXECUTION COMPLETE ---');
                    console.log('[DB startInitialization] Verifying chat_threads table existence AFTER schema exec...');
                    const verifyResult = await instance.query<{ exists: boolean }>(checkSql);
                    console.log(`[DB startInitialization] Verification result: chat_threads exists = ${verifyResult?.rows?.[0]?.exists}`);
                } else {
                    console.log('[DB startInitialization] chat_threads table already exists. Assuming schema is up-to-date.');
                }
                console.log('[DB startInitialization] Applying database schema COMPLETE.');
            } catch (schemaError) {
                console.error('[DB startInitialization] Error during schema check/application:', schemaError);
                throw schemaError;
            }
            // --- END Schema ---

            console.log('[DB startInitialization] Initialization complete. Assigning instance to \'db\'.');
            db = instance; // Assign ONLY after everything is ready
            return db; // Resolve the promise with the instance
        } catch (error) {
            console.error('[DB startInitialization] PGlite initialization or schema application failed:', error);
            dbReadyPromise = null; // Clear promise on failure
            db = null; // Clear instance on failure
            throw error; // Reject the promise
        }
    })();
}

// Exported function to trigger initialization if needed (e.g., explicitly from background)
// Ensures the promise is created but doesn't necessarily wait here.
export function ensureDbInitialized(): Promise<PGlite> {
    if (!dbReadyPromise) {
        console.log('[DB ensureDbInitialized] No promise found. Starting initialization.');
        dbReadyPromise = startInitialization();
    } else {
        console.log('[DB ensureDbInitialized] Initialization promise already exists.');
    }
    return dbReadyPromise;
}


// Gets the instance, ALWAYS waiting for the current initialization promise.
export async function getDbInstance(): Promise<PGlite> {
    // If the promise doesn't exist yet (e.g., worker just restarted and background didn't call ensureDbInitialized yet)
    // create it by calling ensureDbInitialized.
    if (!dbReadyPromise) {
         console.warn('[DB getDbInstance] No promise found! Triggering initialization implicitly via ensureDbInitialized.');
         // This sets dbReadyPromise = startInitialization()
         ensureDbInitialized(); // Don't await here, just ensure the promise is created
    }

    // Now, dbReadyPromise is guaranteed to be non-null (either from background or implicitly set above).
    // Await the promise. This ensures we wait for the *current* initialization to complete fully
    // (including schema and assignment to 'db') before proceeding.
    console.log('[DB getDbInstance] Awaiting the dbReadyPromise...');
    try {
        // Important: Directly await the module-level promise variable,
        // which might have been set by ensureDbInitialized just above or earlier.
        const instance = await dbReadyPromise!; // Use non-null assertion as we ensured it's set
        console.log('[DB getDbInstance] dbReadyPromise resolved. Returning instance.');
        
        // Double check 'db' variable after awaiting. It *should* be set by startInitialization on success.
        if (!db) {
             console.error("[DB getDbInstance] CRITICAL ERROR: dbReadyPromise resolved but 'db' variable is still null! Returning instance from promise directly.");
             // If db is null, something went wrong with the assignment logic in startInitialization,
             // but the promise did resolve, so return the instance we got from it.
             return instance;
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
