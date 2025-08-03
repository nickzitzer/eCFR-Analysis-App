const axios = require('axios');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Client } = require('@elastic/elasticsearch');
const { parseStringPromise } = require('xml2js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const esClient = new Client({ 
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  headers: {
    'compatible-with': 9
  },
});

const ADMIN_API_URL = 'https://www.ecfr.gov/api/admin/v1';
const VERSIONER_API_URL = 'https://www.ecfr.gov/api/versioner/v1';

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

async function fetchAndStoreRegulationContent(client, date) {
  console.log(`Fetching regulation content for ${date}...`);
  const titlesResponse = await axios.get(`${VERSIONER_API_URL}/titles.json`);
  const titlesFromApi = titlesResponse.data.titles;

  const titlesFromDb = await client.query('SELECT id, title_number, name FROM titles');
  
  const fk = await import('flesch-kincaid');

  for (const title of titlesFromDb.rows) {
    const apiTitle = titlesFromApi.find(t => t.number === title.title_number);
    if (!apiTitle || apiTitle.reserved) {
      continue;
    }

    console.log(`Fetching content for Title ${title.title_number}: ${title.name}`);
    const structureResponse = await axios.get(`${VERSIONER_API_URL}/structure/${date}/title-${title.title_number}.json`);
    
    for (const chapter of structureResponse.data.children) {
      const chapterRes = await client.query('SELECT id FROM chapters WHERE title_id = $1 AND chapter_identifier = $2', [title.id, chapter.identifier]);
      if (chapterRes.rows.length === 0) continue;
      const chapterId = chapterRes.rows[0].id;

      for (const part of chapter.children) {
        const partName = part.name || `Part ${part.identifier}`;
        const partRes = await client.query('INSERT INTO parts (chapter_id, name, ecfr_id) VALUES ($1, $2, $3) ON CONFLICT (chapter_id, ecfr_id) DO UPDATE SET name = EXCLUDED.name RETURNING id', [chapterId, partName, part.identifier]);
        const partId = partRes.rows[0].id;
        console.log(`  Upserted Part: ${partName}`);
        
        if (part.children) {
          for (const section of part.children) {
            if (!section.identifier) continue;
            
            const sectionName = section.name || `Section ${section.identifier}`;
            const sectionRes = await client.query('INSERT INTO sections (part_id, name, ecfr_id, type) VALUES ($1, $2, $3, $4) ON CONFLICT (part_id, ecfr_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type RETURNING id', [partId, sectionName, section.identifier, section.node_type]);
            const sectionId = sectionRes.rows[0].id;

            let content = `Content not available for section ${section.identifier}.`;
            let word_count = 0;
            let complexity_score = 0;
            let checksum = '';

            try {
                const url = `${VERSIONER_API_URL}/full/${date}/title-${title.title_number}.xml?part=${part.identifier}&section=${section.identifier}`;
                console.log(`  Fetching content for section ${section.identifier} from ${url}`);

                const contentResponse = await axios.get(url);
                const xml = contentResponse.data;
                const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
                
                function extractTextFromNode(node) {
                  if (typeof node === 'string') {
                    return node + ' ';
                  }
                  if (Array.isArray(node)) {
                    return node.map(extractTextFromNode).join('');
                  }
                  if (typeof node === 'object' && node !== null) {
                    let text = '';
                    if (node._) {
                      text += node._ + ' ';
                    }
                    for (const key in node) {
                      if (key !== '_' && key !== '$') {
                        text += extractTextFromNode(node[key]);
                      }
                    }
                    return text;
                  }
                  return '';
                }

                let extractedText = '';
                if (parsed.DIV1) {
                  extractedText = extractTextFromNode(parsed.DIV1);
                } else if (parsed.DIV) {
                  extractedText = extractTextFromNode(parsed.DIV);
                } else {
                  extractedText = JSON.stringify(parsed);
                }
                
                content = extractedText.trim();

                if (!content) {
                    content = `Content not available for section ${section.identifier}.`;
                }
                console.log(`  Fetched content for section ${section.identifier}:`);
                console.log(`    Content: ${content}`);

                word_count = content.split(/\s+/).length;
                complexity_score = fk.fleschKincaid(content);
                checksum = crypto.createHash('sha256').update(content).digest('hex');
            } catch (error) {
                console.error(`Failed to fetch or parse content for section ${section.identifier}:`, error.message);
            }

            await client.query(
              'INSERT INTO section_versions (section_id, effective_date, content, word_count, complexity_score, checksum) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (section_id, effective_date) DO NOTHING',
              [sectionId, date, content, word_count, complexity_score, checksum]
            );

            await esClient.index({
                index: 'regulations',
                id: `${sectionId}-${date}`,
                body: {
                    title: sectionName,
                    text: content,
                    part_name: partName,
                    chapter_name: chapter.name,
                    title_number: title.title_number,
                    effective_date: date,
                },
            });
          }
        }
      }
    }
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

    const titlesResponse = await axios.get(`${VERSIONER_API_URL}/titles.json`);
    const titlesFromApi = titlesResponse.data.titles;
    const latest_issue_date = titlesFromApi[0].latest_issue_date;
    await fetchAndStoreRegulationContent(client, latest_issue_date);

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
