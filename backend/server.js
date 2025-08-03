require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const QueryStream = require('pg-query-stream');
const cron = require('node-cron');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3001;

// Gemini AI client setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// PostgreSQL client setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      db: result.rows[0],
    });
    client.release();
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to the database.',
      error: err.message,
    });
  }
});

// API Endpoints

// Agencies
app.get('/api/agencies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM agencies');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agencies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM agencies WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agencies/:id/regulations', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            WITH RECURSIVE agency_hierarchy AS (
                SELECT id FROM agencies WHERE id = $1
                UNION
                SELECT a.id FROM agencies a
                INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
            )
            SELECT DISTINCT t.*
            FROM titles t
            JOIN chapters c ON t.id = c.title_id
            JOIN agency_cfr_references acr ON c.id = acr.chapter_id
            WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy);
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/complexity', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;
        let params = [];

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $1
                    UNION
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT AVG(sv.complexity_score) as avg_complexity
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy);
            `;
            params = [agencyId];
        } else {
            query = 'SELECT AVG(complexity_score) as avg_complexity FROM section_versions;';
        }

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/amendments', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;
        let params = [];

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $1
                    UNION
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT COUNT(sv.id) / (CAST(EXTRACT(YEAR FROM MAX(sv.effective_date)) - EXTRACT(YEAR FROM MIN(sv.effective_date)) AS decimal) + 1) as avg_amendments
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy);
            `;
            params = [agencyId];
        } else {
            query = 'SELECT COUNT(id) / (CAST(EXTRACT(YEAR FROM MAX(effective_date)) - EXTRACT(YEAR FROM MIN(effective_date)) AS decimal) + 1) as avg_amendments FROM section_versions;';
        }

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/regulations-by-agency', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;
        let params = [];

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $1
                    UNION ALL
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT 
                    a.id,
                    a.short_name,
                    a.name,
                    COUNT(DISTINCT p.id) as count
                FROM agencies a
                JOIN agency_cfr_references acr ON a.id = acr.agency_id
                JOIN chapters ch ON acr.chapter_id = ch.id
                JOIN parts p ON ch.id = p.chapter_id
                WHERE a.id IN (SELECT id FROM agency_hierarchy)
                GROUP BY a.id, a.short_name, a.name
                ORDER BY count DESC;
            `;
            params = [agencyId];
        } else {
            query = `
                SELECT 
                    a.id,
                    a.short_name,
                    a.name,
                    COUNT(DISTINCT p.id) as count
                FROM agencies a
                JOIN agency_cfr_references acr ON a.id = acr.agency_id
                JOIN chapters ch ON acr.chapter_id = ch.id
                JOIN parts p ON ch.id = p.chapter_id
                GROUP BY a.id, a.short_name, a.name
                ORDER BY count DESC;
            `;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/complexity-over-time', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;
        let params = [];

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $1
                    UNION
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT 
                    EXTRACT(YEAR FROM sv.effective_date) as year,
                    AVG(sv.complexity_score) as score
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy)
                GROUP BY year
                ORDER BY year;
            `;
            params = [agencyId];
        } else {
            query = `
                SELECT 
                    EXTRACT(YEAR FROM effective_date) as year,
                    AVG(complexity_score) as score
                FROM section_versions
                GROUP BY year
                ORDER BY year;
            `;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/word-count', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;
        let params = [];

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $1
                    UNION
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT SUM(sv.word_count) as total_word_count
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy);
            `;
            params = [agencyId];
        } else {
            query = 'SELECT SUM(word_count) as total_word_count FROM section_versions;';
        }

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/unique-word-count', async (req, res) => {
    try {
        const { agencyId } = req.query;
        let query;

        if (agencyId) {
            const agencyIdInt = parseInt(agencyId, 10);
            if (isNaN(agencyIdInt)) {
                return res.status(400).json({ error: 'Invalid agencyId' });
            }

            const subquery = `
                SELECT sv.search_vector
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (
                    WITH RECURSIVE agency_hierarchy AS (
                        SELECT id FROM agencies WHERE id = ${agencyIdInt}
                        UNION
                        SELECT a.id FROM agencies a
                        INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                    )
                    SELECT id FROM agency_hierarchy
                )
            `;

            query = `
                SELECT COUNT(DISTINCT lexeme) as total_unique_word_count
                FROM (
                    SELECT (ts_stat.word) as lexeme
                    FROM ts_stat($$${subquery}$$) as ts_stat
                ) as subquery;
            `;
        } else {
            query = `
                SELECT COUNT(DISTINCT lexeme) as total_unique_word_count
                FROM (
                    SELECT (ts_stat.word) as lexeme
                    FROM ts_stat('SELECT search_vector FROM section_versions') as ts_stat
                ) as subquery;
            `;
        }

        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Titles
app.get('/api/titles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM titles ORDER BY title_number');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/titles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM titles WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/titles/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const titleQuery = 'SELECT * FROM titles WHERE id = $1';
        const titleResult = await pool.query(titleQuery, [id]);
        const title = titleResult.rows[0];

        if (!title) {
            return res.status(404).json({ error: 'Title not found' });
        }

        const chaptersQuery = 'SELECT * FROM chapters WHERE title_id = $1 ORDER BY id';
        const chaptersResult = await pool.query(chaptersQuery, [id]);
        const chapters = chaptersResult.rows;

        for (const chapter of chapters) {
            const partsQuery = 'SELECT * FROM parts WHERE chapter_id = $1 ORDER BY id';
            const partsResult = await pool.query(partsQuery, [chapter.id]);
            const parts = partsResult.rows;
            chapter.parts = parts;

            for (const part of parts) {
                const sectionsQuery = `
                    SELECT
                        s.id,
                        s.name,
                        s.parent_id,
                        sv.content
                    FROM sections s
                    LEFT JOIN (
                        SELECT
                            sv_inner.section_id,
                            sv_inner.content,
                            ROW_NUMBER() OVER(PARTITION BY sv_inner.section_id ORDER BY sv_inner.effective_date DESC) as rn
                        FROM section_versions sv_inner
                    ) sv ON s.id = sv.section_id AND sv.rn = 1
                    WHERE s.part_id = $1
                    ORDER BY s.id;
                `;
                const sectionsResult = await pool.query(sectionsQuery, [part.id]);
                part.sections = sectionsResult.rows;
            }
        }

        const statsQuery = `
            SELECT
                t.total_unique_word_count,
                COUNT(DISTINCT c.id) as chapter_count,
                COUNT(DISTINCT p.id) as part_count,
                COUNT(DISTINCT s.id) as section_count,
                SUM(sv.word_count) as total_word_count,
                AVG(sv.complexity_score) as avg_complexity,
                MAX(sv.effective_date) as latest_revision,
                COUNT(sv.id) as total_revisions,
                COUNT(sv.id) / (EXTRACT(YEAR FROM MAX(sv.effective_date)) - EXTRACT(YEAR FROM MIN(sv.effective_date)) + 1) as avg_revisions_per_year
            FROM titles t
            LEFT JOIN chapters c ON t.id = c.title_id
            LEFT JOIN parts p ON c.id = p.chapter_id
            LEFT JOIN sections s ON p.id = s.part_id
            LEFT JOIN section_versions sv ON s.id = sv.section_id
            WHERE t.id = $1
            GROUP BY t.id;
        `;
        const statsResult = await pool.query(statsQuery, [id]);
        const stats = statsResult.rows[0];

        res.json({
            ...title,
            chapters,
            stats: stats
        });
  } catch (err) {
    console.error('Error fetching title details:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM parts WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sections
app.get('/api/sections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM sections WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, agencyId } = req.query;
        
        let query;
        let params;

        if (agencyId) {
            query = `
                WITH RECURSIVE agency_hierarchy AS (
                    SELECT id FROM agencies WHERE id = $2
                    UNION
                    SELECT a.id FROM agencies a
                    INNER JOIN agency_hierarchy ah ON a.parent_id = ah.id
                )
                SELECT 
                    t.id as title_id,
                    t.name as title_name,
                    s.id as section_id,
                    ts_headline('simple', sv.content, plainto_tsquery('simple', $1)) as excerpt
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN titles t ON c.title_id = t.id
                JOIN agency_cfr_references acr ON c.id = acr.chapter_id
                WHERE acr.agency_id IN (SELECT id FROM agency_hierarchy)
                AND sv.search_vector @@ plainto_tsquery('simple', $1);
            `;
            params = [q, agencyId];
        } else {
            query = `
                SELECT 
                    t.id as title_id,
                    t.name as title_name,
                    s.id as section_id,
                    ts_headline('simple', sv.content, plainto_tsquery('simple', $1)) as excerpt
                FROM section_versions sv
                JOIN sections s ON sv.section_id = s.id
                JOIN parts p ON s.part_id = p.id
                JOIN chapters c ON p.chapter_id = c.id
                JOIN titles t ON c.title_id = t.id
                WHERE sv.search_vector @@ plainto_tsquery('simple', $1);
            `;
            params = [q];
        }

        const result = await pool.query(query, params);
        
        const groupedResults = result.rows.reduce((acc, row) => {
            const { title_id, title_name, section_id, excerpt } = row;
            if (!acc[title_id]) {
                acc[title_id] = {
                    title_id,
                    title_name,
                    sections: []
                };
            }
            acc[title_id].sections.push({ section_id, excerpt });
            return acc;
        }, {});

        res.json(Object.values(groupedResults));
    } catch (err) {
        console.error('PostgreSQL search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Section Versions
app.get('/api/section_versions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM section_versions');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/section_versions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM section_versions WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();
    res.json({ text });
  } catch (error) {
    console.error('Error with Gemini API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});

// Schedule cron job to run fetch-ecfr-data-v2.js daily at midnight
cron.schedule('0 0 * * *', () => {
  console.log('Running daily eCFR data fetch...');
  exec('node /usr/src/app/scripts/fetch-ecfr-data-v2.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error}`);
      return;
    }
    console.log(`Script output: ${stdout}`);
    console.error(`Script errors: ${stderr}`);
  });
});
