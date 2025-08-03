const axios = require('axios');
const { Pool } = require('pg');
const crypto = require('crypto');
const { parseStringPromise } = require('xml2js');
const { syllable } = require('syllable');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ADMIN_API_URL = 'https://www.ecfr.gov/api/admin/v1';
const VERSIONER_API_URL = 'https://www.ecfr.gov/api/versioner/v1';

function getTextFromNode(node) {
  let text = '';
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join('\n');
  }
  if (node && typeof node === 'object') {
    // Text content is often in the '_' property with xml2js
    if (node._) {
      text += node._ + ' ';
    }
    // Recursively process child nodes
    for (const key in node) {
      if (key !== '_' && key !== '$') {
        text += getTextFromNode(node[key]);
      }
    }
  }
  return text;
}

async function insertAgency(client, agency, parentId = null) {
  const { name, short_name, display_name, sortable_name, slug, children, cfr_references } = agency;
  const res = await client.query(
    'INSERT INTO agencies (parent_id, name, short_name, display_name, sortable_name, slug) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, short_name = EXCLUDED.short_name, display_name = EXCLUDED.display_name, sortable_name = EXCLUDED.sortable_name, parent_id = EXCLUDED.parent_id RETURNING id',
    [parentId, name, short_name, display_name, sortable_name, slug]
  );
  const newAgencyId = res.rows[0].id;
  console.log(`Upserted agency: ${name}`);

  if (cfr_references) {
    for (const ref of cfr_references) {
      const chapterRes = await client.query('SELECT id FROM chapters WHERE title_id = (SELECT id FROM titles WHERE title_number = $1) AND chapter_identifier = $2', [ref.title, ref.chapter]);
      if (chapterRes.rows.length > 0) {
        const chapterId = chapterRes.rows[0].id;
        await client.query('INSERT INTO agency_cfr_references (agency_id, chapter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newAgencyId, chapterId]);
      }
    }
  }

  if (children && children.length > 0) {
    for (const child of children) {
      await insertAgency(client, child, newAgencyId);
    }
  }
}

async function processNode(node, client, title, date, chapterId, partId, parentSectionId) {
  const nodeType = node.$?.TYPE;
  const nodeName = getTextFromNode(node.HEAD?.[0] || `Unnamed ${nodeType}`).trim();
  const nodeId = node.$?.N;

  let currentPartId = partId;
  let currentSectionId = parentSectionId;

  if (nodeName.startsWith('PART')) {
    const partRes = await client.query(
      'INSERT INTO parts (chapter_id, name, ecfr_id) VALUES ($1, $2, $3) ON CONFLICT (chapter_id, ecfr_id) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [chapterId, nodeName, nodeId]
    );
    currentPartId = partRes.rows[0].id;
    console.log(`  Upserted Part: ${nodeName}`);
  } else if (nodeType === 'SECTION' || nodeType === 'SUBPART') {
    if (currentPartId) {
      const sectionRes = await client.query(
        'INSERT INTO sections (part_id, parent_id, name, ecfr_id, type) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (part_id, ecfr_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_id = EXCLUDED.parent_id RETURNING id',
        [currentPartId, parentSectionId, nodeName, nodeId, nodeType]
      );
      currentSectionId = sectionRes.rows[0].id;

      const content = getTextFromNode(node).trim();
      const word_count = content.split(/\s+/).filter(Boolean).length;
      
      const complexity_score = await calculateFleschKincaid(content);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      await client.query(
        `INSERT INTO section_versions (section_id, effective_date, content, word_count, complexity_score, checksum)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (section_id, effective_date)
         DO UPDATE SET
           content = EXCLUDED.content,
           word_count = EXCLUDED.word_count,
           complexity_score = EXCLUDED.complexity_score,
           checksum = EXCLUDED.checksum
         WHERE
           section_versions.checksum IS DISTINCT FROM EXCLUDED.checksum`,
        [currentSectionId, date, content, word_count, complexity_score, checksum]
      );

      const chapterNameRes = await client.query('SELECT name FROM chapters WHERE id = $1', [chapterId]);
      const partNameRes = await client.query('SELECT name FROM parts WHERE id = $1', [currentPartId]);
    }
  }

  for (const key in node) {
    if (key.startsWith('DIV') || ['SECTION', 'SUBPART', 'PART'].includes(key)) {
      const children = Array.isArray(node[key]) ? node[key] : [node[key]];
      for (const child of children) {
        await processNode(child, client, title, date, chapterId, currentPartId, currentSectionId);
      }
    }
  }
}

async function updateTitleUniqueWordCount(client, titleId) {
  console.log(`Calculating unique word count for title ${titleId}`);
  const contentRes = await client.query(`
    SELECT sv.content
    FROM section_versions sv
    JOIN sections s ON sv.section_id = s.id
    JOIN parts p ON s.part_id = p.id
    JOIN chapters c ON p.chapter_id = c.id
    WHERE c.title_id = $1;
  `, [titleId]);

  const uniqueWords = new Set();
  for (const row of contentRes.rows) {
    const words = (row.content || '').toLowerCase().match(/\b\w+\b/g);
    if (words) {
      for (const word of words) {
        uniqueWords.add(word);
      }
    }
  }

  await client.query(
    'UPDATE titles SET total_unique_word_count = $1 WHERE id = $2',
    [uniqueWords.size, titleId]
  );
  console.log(`Updated title ${titleId} with unique word count of ${uniqueWords.size}`);
}

async function fetchWithRetry(url, options, retries = 3, delay = 60000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, options);
        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
                if (i < retries - 1) {
                    console.log(`Request timed out. Retrying in ${delay / 1000}s... (${i + 1}/${retries - 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                } else {
                    throw new Error(`Failed to fetch ${url} after ${retries} attempts.`);
                }
            } else {
                throw error;
            }
        }
    }
}

async function fetchAndStoreRegulationContent(client, date = null) {
  console.log(`Fetching regulation content...`);

  const titlesResponse = await axios.get(`${VERSIONER_API_URL}/titles.json`);
  const titlesFromApi = titlesResponse.data.titles;

  const titlesFromDb = await client.query('SELECT id, title_number, name FROM titles');

  for (const title of titlesFromDb.rows) {
    const apiTitle = titlesFromApi.find(t => t.number === title.title_number);
    if (!apiTitle || apiTitle.reserved) {
      continue;
    }

    const effectiveDate = date || apiTitle.latest_issue_date;
    console.log(`Fetching content for Title ${title.title_number}: ${title.name} for date ${effectiveDate}`);
    try {
      const url = `${VERSIONER_API_URL}/full/${effectiveDate}/title-${title.title_number}.xml`;
      const contentResponse = await fetchWithRetry(url, { timeout: 600000 }); // 10 minute timeout
      const xml = contentResponse.data;
      const parsed = await parseStringPromise(xml, { explicitArray: true, trim: true });

      if (!parsed.ECFR || !parsed.ECFR.DIV1) {
        console.log(`Skipping Title ${title.title_number} due to unexpected XML structure.`);
        continue;
      }

      const div1 = parsed.ECFR.DIV1[0];
      const chaptersData = div1.DIV2?.[0]?.DIV3 || div1.DIV3;

      if (!chaptersData) {
        console.log(`No chapters found for Title ${title.title_number}`);
        continue;
      }

      for (const chapterData of chaptersData) {
        const chapterIdentifier = chapterData.$.N;
        const chapterRes = await client.query('SELECT id FROM chapters WHERE title_id = $1 AND chapter_identifier = $2', [title.id, chapterIdentifier]);
        if (chapterRes.rows.length === 0) continue;
        const chapterId = chapterRes.rows[0].id;

        const childNodeKeys = Object.keys(chapterData).filter(k => k.startsWith('DIV') || k === 'PART');
        for(const nodeKey of childNodeKeys) {
            const nodes = Array.isArray(chapterData[nodeKey]) ? chapterData[nodeKey] : [chapterData[nodeKey]];
            for (const node of nodes) {
                 await processNode(node, client, title, effectiveDate, chapterId, null, null);
            }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch or process content for Title ${title.title_number}:`, error.message);
       if (error.response) {
        console.error('API Response:', error.response.status, error.response.statusText);
      }
    }
    await updateTitleUniqueWordCount(client, title.id);
  }
}


async function fetchAndStoreTitlesAndChapters(client) {
  console.log('Fetching titles and chapters...');
  const response = await axios.get(`${VERSIONER_API_URL}/titles.json`);
  const titles = response.data.titles;

  for (const title of titles) {
    if (title.reserved) {
      console.log(`Skipping reserved title: ${title.name}`);
      continue;
    }

    const titleRes = await client.query('INSERT INTO titles (title_number, name) VALUES ($1, $2) ON CONFLICT (title_number) DO UPDATE SET name = EXCLUDED.name RETURNING id', [title.number, title.name]);
    const titleId = titleRes.rows[0].id;
    console.log(`Upserted title: ${title.name}`);

    const structureResponse = await axios.get(`${VERSIONER_API_URL}/structure/${title.latest_issue_date}/title-${title.number}.json`);
    const chapters = structureResponse.data.children;

    for (const chapter of chapters) {
      const chapterName = chapter.name || `Chapter ${chapter.identifier}`;
      await client.query('INSERT INTO chapters (title_id, chapter_identifier, name) VALUES ($1, $2, $3) ON CONFLICT (title_id, chapter_identifier) DO UPDATE SET name = EXCLUDED.name', [titleId, chapter.identifier, chapterName]);
      console.log(`  Upserted chapter: ${chapterName}`);
    }
  }
}

async function fetchAndStoreAgencies(client) {
  console.log('Fetching agencies...');
  const response = await axios.get(`${ADMIN_API_URL}/agencies.json`);
  const agencies = response.data.agencies;

  for (const agency of agencies) {
    await insertAgency(client, agency);
  }
}

async function fetchAndStoreHistoricalData() {
  console.log('Starting historical eCFR data fetch...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const titlesResponse = await axios.get(`${VERSIONER_API_URL}/titles.json`);
    const titles = titlesResponse.data.titles;

    for (const title of titles) {
      if (title.reserved) continue;

      const versionsResponse = await axios.get(`${VERSIONER_API_URL}/versions/title-${title.number}`);
      const versions = versionsResponse.data.versions;

      for (const version of versions) {
        await fetchAndStoreRegulationContent(client, version.date);
      }
    }

    await client.query('COMMIT');
    console.log('All historical data inserted successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during historical data fetch process:', error);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
  finally {
    client.release();
  }
}

async function fetchAndStoreCurrentData() {
  console.log('Starting current eCFR data fetch...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await fetchAndStoreTitlesAndChapters(client);
    await fetchAndStoreAgencies(client);

    // This always times out - use process local data manually await fetchAndStoreRegulationContent(client);

    await client.query('COMMIT');
    console.log('All current data inserted successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during current data fetch process:', error);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
  finally {
    client.release();
  }
}

/**
 * Calculates the Flesch-Kincaid grade level for a given string of text.
 * @param {string} content The raw text content to analyze.
 * @returns {Promise<number>} A promise that resolves to the Flesch-Kincaid grade level score, or NaN if calculation is not possible.
 */
async function calculateFleschKincaid(content) {
  // 1. Basic validation to ensure we have something to work with.
  if (!content || typeof content !== 'string' || content.trim() === '') {
    console.error("Error: Provided content is empty or not a string.");
    return NaN;
  }

  // 2. Clean up the content and count the words.
  // We split by any whitespace character.
  const words = content.trim().split(/\s+/);
  const word_count = words.length;

  let complexity_score = NaN; // Default score

  // 3. Check if there is enough content for a meaningful score.
  // The Flesch-Kincaid formula is less reliable on very short texts.
  if (word_count > 20) {
    try {
      // 4. Count sentences. A common heuristic is to count terminal punctuation.
      // We look for sequences of characters ending in a period, exclamation mark, or question mark.
      // If no punctuation is found, we assume it's a single sentence.
      const sentence_count = content.match(/[^.!?]+[.!?]+/g)?.length || 1;

      // 5. Count syllables using the 'syllable' library.
      // This library does the heavy lifting of estimating syllables for the entire text.
      const syllable_count = syllable(content);

      // --- DEBUG LOGS ---
      // You can uncomment these to see the counts.
      // console.log(`Word Count: ${word_count}`);
      // console.log(`Sentence Count: ${sentence_count}`);
      // console.log(`Syllable Count: ${syllable_count}`);
      // ------------------

      const { fleschKincaid } = await import('flesch-kincaid');

      // 6. Call fleschKincaid with the required object containing the counts.
      const score = fleschKincaid({
        sentence: sentence_count,
        word: word_count,
        syllable: syllable_count,
      });

      if (!isNaN(score)) {
        complexity_score = score;
      }
    } catch (error) {
        console.error("An error occurred during score calculation:", error);
        return NaN;
    }
  } else {
    console.log("Note: Content is too short (fewer than 21 words) to calculate a reliable score.");
  }

  return complexity_score;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--historical')) {
    await fetchAndStoreHistoricalData();
  } else {
    await fetchAndStoreCurrentData();
  }
  await pool.end();
  console.log('Database connection closed.');
}

main();
