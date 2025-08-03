-- Drop tables in reverse order of creation to avoid foreign key constraints
DROP TABLE IF EXISTS section_versions;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS agency_cfr_references;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS agencies;

-- Create the agencies table to store agency details and hierarchy
CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES agencies(id),
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(255),
    display_name VARCHAR(255),
    sortable_name VARCHAR(255),
    slug VARCHAR(255) UNIQUE
);

-- Create the titles table for the top-level eCFR structure
CREATE TABLE titles (
    id SERIAL PRIMARY KEY,
    title_number INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    total_unique_word_count INTEGER
);

-- Create the chapters table for chapters within a title
CREATE TABLE chapters (
    id SERIAL PRIMARY KEY,
    title_id INTEGER REFERENCES titles(id),
    chapter_identifier VARCHAR(255) NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (title_id, chapter_identifier)
);

-- Create a join table to link agencies to their CFR chapter references
CREATE TABLE agency_cfr_references (
    agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    PRIMARY KEY (agency_id, chapter_id)
);

-- Create the parts table for organizational units within a chapter
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER REFERENCES chapters(id),
    name TEXT NOT NULL,
    ecfr_id VARCHAR(255) NOT NULL,
    UNIQUE (chapter_id, ecfr_id)
);

-- Create the sections table for the most granular level of regulations
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id),
    parent_id INTEGER REFERENCES sections(id),
    name TEXT NOT NULL,
    ecfr_id VARCHAR(255) NOT NULL,
    type VARCHAR(255),
    UNIQUE (part_id, ecfr_id)
);

-- Create the section_versions table to store versioned content for each section
CREATE TABLE section_versions (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id),
    effective_date DATE NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER,
    complexity_score FLOAT,
    unique_words JSONB,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    search_vector tsvector,
    UNIQUE (section_id, effective_date)
);

-- Create a function to update the search_vector column
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
DECLARE
    section_name TEXT;
    part_name TEXT;
    chapter_name TEXT;
    title_name TEXT;
BEGIN
    -- Get the names from the related tables
    SELECT s.name INTO section_name FROM sections s WHERE s.id = NEW.section_id;
    SELECT p.name INTO part_name FROM parts p JOIN sections s ON p.id = s.part_id WHERE s.id = NEW.section_id;
    SELECT c.name INTO chapter_name FROM chapters c JOIN parts p ON c.id = p.chapter_id JOIN sections s ON p.id = s.part_id WHERE s.id = NEW.section_id;
    SELECT t.name INTO title_name FROM titles t JOIN chapters c ON t.id = c.title_id JOIN parts p ON c.id = p.chapter_id JOIN sections s ON p.id = s.part_id WHERE s.id = NEW.section_id;

    -- Combine all text fields into the search_vector
    NEW.search_vector = 
        to_tsvector('simple', COALESCE(LEFT(NEW.content, 1048575), '')) ||
        to_tsvector('simple', COALESCE(section_name, '')) ||
        to_tsvector('simple', COALESCE(part_name, '')) ||
        to_tsvector('simple', COALESCE(chapter_name, '')) ||
        to_tsvector('simple', COALESCE(title_name, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the search_vector column
CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON section_versions
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Add indexes for performance
CREATE INDEX idx_agencies_parent_id ON agencies(parent_id);
CREATE INDEX idx_chapters_title_id ON chapters(title_id);
CREATE INDEX idx_parts_chapter_id ON parts(chapter_id);
CREATE INDEX idx_sections_part_id ON sections(part_id);
CREATE INDEX idx_sections_parent_id ON sections(parent_id);
CREATE INDEX idx_section_versions_section_id ON section_versions(section_id);
CREATE INDEX idx_section_versions_effective_date ON section_versions(effective_date);
CREATE INDEX idx_section_versions_checksum ON section_versions(checksum);
CREATE INDEX idx_agency_cfr_references_agency_id ON agency_cfr_references(agency_id);
CREATE INDEX idx_agency_cfr_references_chapter_id ON agency_cfr_references(chapter_id);
CREATE INDEX idx_section_versions_search_vector ON section_versions USING GIN(search_vector);
