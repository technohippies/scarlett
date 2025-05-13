import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB Domains] Service loaded.');

interface DomainFromCsv {
  domain_name: string;
  category: string;
}

/**
 * Parses CSV content into an array of DomainFromCsv objects.
 * Assumes CSV format: domain_name,category (with a header row that is skipped)
 */
function parseDomainCsv(csvContent: string): DomainFromCsv[] {
  const domains: DomainFromCsv[] = [];
  const lines = csvContent.trim().split('\n');

  if (lines.length <= 1) { // Only header or empty
    return domains;
  }

  // Skip header row (lines[0])
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const parts = line.split(',');
    if (parts.length >= 2) {
      const domain_name = parts[0].trim();
      const category = parts[1].trim();
      if (domain_name && category) {
        domains.push({ domain_name, category });
      }
    }
  }
  return domains;
}

/** 
 * Seeds the database with initial blocked domains from public/domains/domain-list.csv.
 * Uses ON CONFLICT DO NOTHING to avoid duplicates.
 */
export async function seedInitialBlockedDomains(): Promise<void> {
  console.log('[DB Seed] Seeding initial blocked domains START...');
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    console.log('[DB Seed] Got DB instance for seeding blocked domains.');

    if (!db) {
      console.error('[DB Seed] Failed to get DB instance for blocked domains. Aborting seed.');
      return;
    }

    // Fetch the CSV file from the public directory
    const csvUrl = '/domains/domain-list.csv'; // Path relative to public directory
    console.log(`[DB Seed] Fetching domain list from: ${csvUrl}`);
    const response = await fetch(csvUrl);
    if (!response.ok) {
      console.error(`[DB Seed] Failed to fetch domain-list.csv: ${response.statusText}`);
      return;
    }
    const csvContent = await response.text();
    console.log('[DB Seed] Successfully fetched domain-list.csv content.');

    const domainsToSeed = parseDomainCsv(csvContent);
    if (domainsToSeed.length === 0) {
      console.log('[DB Seed] No domains found in CSV or CSV is empty. Nothing to seed.');
      return;
    }
    console.log(`[DB Seed] Parsed ${domainsToSeed.length} domains from CSV.`);

    // Prepare data for batch insert
    // Values will be (domain_name, category)
    const valuesPlaceholders = domainsToSeed.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
    const flattenedValues: string[] = [];
    domainsToSeed.forEach(domain => {
      flattenedValues.push(domain.domain_name);
      flattenedValues.push(domain.category);
    });

    const sql = `
      INSERT INTO blocked_domains (domain_name, category) 
      VALUES ${valuesPlaceholders} 
      ON CONFLICT (domain_name) DO NOTHING;
    `;

    console.log('[DB Seed] Executing batch insert SQL for blocked domains...');
    await db.query(sql, flattenedValues);
    console.log('[DB Seed] Batch seeding SQL for blocked domains execution complete.');

    // Optional: Verify insertion
    // const result = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM blocked_domains;');
    // console.log(`[DB Seed] Verification: Found ${result.rows[0].count} blocked domains after seeding.`);

  } catch (error: any) {
    console.error('[DB Seed] Error during batch seeding of blocked domains:', error);
  } finally {
    console.log('[DB Seed] Seeding initial blocked domains END.');
  }
}

/**
 * Retrieves all domains from the blocked_domains table.
 */
export async function getAllBlockedDomains(): Promise<{ name: string; category: string }[]> {
  console.log('[DB Domains] Fetching all blocked domains...');
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    if (!db) {
      console.error('[DB Domains] Failed to get DB instance for getAllBlockedDomains.');
      return [];
    }

    const result = await db.query<{ domain_name: string; category: string }>('SELECT domain_name, category FROM blocked_domains;');
    
    if (result && result.rows) {
      console.log(`[DB Domains] Found ${result.rows.length} domains.`);
      // Map domain_name to name to align with DomainDetail usage elsewhere if needed, but keep category
      return result.rows.map(row => ({ name: row.domain_name, category: row.category }));
    }
    console.log('[DB Domains] No domains found or query failed.');
    return [];
  } catch (error) {
    console.error('[DB Domains] Error fetching all blocked domains:', error);
    return []; // Return empty array on error
  }
} 