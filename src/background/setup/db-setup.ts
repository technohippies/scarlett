import { ensureDbInitialized } from '../../services/db/init';

/**
 * Ensures the database is initialized.
 * Should be called during extension installation or startup.
 */
export async function setupDatabase(): Promise<void> {
    try {
      console.log('[DB Setup] Ensuring DB is initialized...');
      await ensureDbInitialized(); // Wait for init to complete
      console.log('[DB Setup] DB initialization check complete.');
    } catch (dbError) {
       console.error('[DB Setup] FATAL: DB initialization failed:', dbError);
       // Re-throw or handle appropriately (e.g., disable features)
       throw dbError;
    }
} 