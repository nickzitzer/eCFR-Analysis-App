const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
const { parseStringPromise } = require('xml2js');
const { syllable } = require('syllable');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function getTextFromNode(node) {
  let text = '';
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join(' ');
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
      console.log(`    Upserted Section/Subpart: ${nodeName}`);

      const content = getTextFromNode(node).trim();
      const word_count = content.split(/\s+/).length;
      let complexity_score = 0;
      if (word_count > 20) { // Only calculate if there's enough content
        const score = await calculateFleschKincaid(content);
        if (!isNaN(score)) {
          complexity_score = score;
        }
      }
      
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
      console.log(`      Inserted content version for section ${currentSectionId}`);

      const chapterNameRes = await client.query('SELECT name FROM chapters WHERE id = $1', [chapterId]);
      const partNameRes = await client.query('SELECT name FROM parts WHERE id = $1', [currentPartId]);
      const agencyRes = await client.query('SELECT agency_id FROM agency_cfr_references WHERE chapter_id = $1', [chapterId]);
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

async function processAndStoreRegulationContent(client) {
  console.log(`Processing local regulation content...`);
  const titlesFromDb = await client.query('SELECT id, title_number, name FROM titles');

  for (const title of titlesFromDb.rows) {
    console.log(`Processing content for Title ${title.title_number}: ${title.name}`);
    try {
      const filePath = path.resolve(__dirname, `../docs/title-${title.title_number}.xml`);
      console.log(`Attempting to read file from: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        console.log(`File not found for Title ${title.title_number} at ${filePath}, skipping.`);
        continue;
      }
      const xml = fs.readFileSync(filePath, 'utf-8');
      const parsed = await parseStringPromise(xml, { explicitArray: true, trim: true });

      let date = parsed.ECFR?.VOLUME?.[0]?.$?.AMDDATE;
      if (!date) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        date = `${year}-${month}-${day}`;
        console.log(`Title ${title.title_number} is missing date information. Using current date: ${date}`);
      } else {
        console.log(`Using revision date from XML: ${date}`);
      }

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
                 await processNode(node, client, title, date, chapterId, null, null);
            }
        }
      }
    } catch (error) {
      console.error(`Failed to process content for Title ${title.title_number}:`, error.message);
    }
    await updateTitleUniqueWordCount(client, title.id);
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

      if (parseFloat(score)) {
        complexity_score = parseFloat(score);
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await processAndStoreRegulationContent(client);
    await client.query('COMMIT');
    console.log('All local data processed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during local data processing:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

main();
