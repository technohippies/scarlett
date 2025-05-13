import { getDbInstance } from './init';
import type { Tag } from './types';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB Tags] Service loaded.');

// --- Predefined Initial Tags ---
const initialTagData: { name: string; description?: string }[] = [
  // Tech
  { name: '#webdev', description: 'Web Development' },
  { name: '#frontend', description: 'Frontend Development' },
  { name: '#backend', description: 'Backend Development' },
  { name: '#database', description: 'Databases' },
  { name: '#ai', description: 'Artificial Intelligence' },
  { name: '#llm', description: 'Large Language Models' },
  { name: '#nlp', description: 'Natural Language Processing' },
  { name: '#machinelearning', description: 'Machine Learning' },
  { name: '#solidjs', description: 'SolidJS Framework' },
  { name: '#react', description: 'React Framework' },
  { name: '#vue', description: 'Vue Framework' },
  { name: '#typescript', description: 'TypeScript Language' },
  { name: '#javascript', description: 'JavaScript Language' },
  { name: '#python', description: 'Python Language' },
  { name: '#rust', description: 'Rust Language' },
  { name: '#go', description: 'Go Language' },
  { name: '#css', description: 'Cascading Style Sheets' },
  { name: '#html', description: 'HyperText Markup Language' },
  { name: '#api', description: 'Application Programming Interface' },
  { name: '#performance', description: 'Web Performance' },
  { name: '#security', description: 'Web Security' },
  { name: '#testing', description: 'Software Testing' },
  { name: '#devops', description: 'DevOps Practices' },
  { name: '#cloud', description: 'Cloud Computing' },
  { name: '#tool', description: 'Developer Tools' },
  { name: '#library', description: 'Software Libraries' },
  { name: '#framework', description: 'Software Frameworks' },
  // General Knowledge & Academia
  { name: '#philosophy', description: 'Philosophy' },
  { name: '#psychology', description: 'Psychology' },
  { name: '#history', description: 'History' },
  { name: '#science', description: 'General Science' },
  { name: '#biology', description: 'Biology' },
  { name: '#physics', description: 'Physics' },
  { name: '#chemistry', description: 'Chemistry' },
  { name: '#astronomy', description: 'Astronomy' },
  { name: '#mathematics', description: 'Mathematics' }, 
  { name: '#economics', description: 'Economics' },
  { name: '#politics', description: 'Politics' },
  { name: '#society', description: 'Society and Culture' },
  { name: '#education', description: 'Education' },
  { name: '#research', description: 'Research Papers/Topics' },
  { name: '#reference', description: 'Reference Material' },
  // Arts & Culture
  { name: '#art', description: 'Art and Design' },
  { name: '#music', description: 'Music' },
  { name: '#literature', description: 'Literature and Books' },
  { name: '#film', description: 'Film and Movies' }, 
  { name: '#culture', description: 'Culture' },
  // Lifestyle & News
  { name: '#health', description: 'Health and Wellness' },
  { name: '#business', description: 'Business' },
  { name: '#news', description: 'General News' },
  { name: '#article', description: 'Articles and Blog Posts' },
  { name: '#tutorial', description: 'Tutorials and How-Tos' },
  { name: '#travel', description: 'Travel' },
  { name: '#food', description: 'Food and Cooking' } 
];

/** 
 * Seeds the database with initial predefined tags if they don't exist.
 * Uses ON CONFLICT DO NOTHING to avoid duplicates.
 */
export async function seedInitialTags(): Promise<void> {
  console.log('[DB Seed] Seeding initial tags START...');
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    console.log('[DB Seed] Got DB instance for seeding.');

    if (!db) {
      console.error('[DB Seed] Failed to get DB instance. Aborting seed.');
      return;
    }

    // Prepare data for batch insert
    // Map 'name' from initialTagData to 'tag_name' for the database column
    const valuesPlaceholder = initialTagData.map((_, index) => `($${index + 1})`).join(', ');
    const flattenedValues = initialTagData.map(tag => tag.name); // Only insert the tag name

    // Use 'tag_name' in the SQL query
    const sql = `
      INSERT INTO tags (tag_name) 
      VALUES ${valuesPlaceholder} 
      ON CONFLICT (tag_name) DO NOTHING; 
    `;

    console.log('[DB Seed] Executing batch insert SQL...');
    await db.query(sql, flattenedValues);
    console.log('[DB Seed] Batch seeding SQL execution complete.');

    // Optionally verify insertion
    // const result = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM tags;');
    // console.log(`[DB Seed] Verification: Found ${result.rows[0].count} tags after seeding.`);

  } catch (error: any) {
    // Log the specific SQL error
    console.error('[DB Seed] Error during batch seeding SQL execution:', error);
    // Optionally, re-throw or handle differently depending on desired behavior
    // throw error; // Re-throw if this should halt background script setup
  } finally {
    console.log('[DB Seed] Seeding initial tags END.');
    // Do not close the db instance here, it's managed globally
  }
}

/**
 * Retrieves all tags from the database.
 */
export async function getAllTags(): Promise<Tag[]> {
  console.log('[DB Tags] Fetching all tags...');
  try {
  const db = await getDbInstance();
    const result = await db.query<Tag>('SELECT tag_id, tag_name FROM tags ORDER BY tag_name;');
    console.log(`[DB Tags] Found ${result.rows.length} tags.`);
    return result.rows || [];
  } catch (error) {
    console.error('[DB Tags] Error fetching tags:', error);
    return []; // Return empty array on error
  }
}

// TODO: Add findOrCreateTag function here later for use by addOrUpdateBookmark 