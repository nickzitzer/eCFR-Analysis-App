# Technical Design: eCFR Analysis App

## 1. Project Overview

The eCFR Analysis App is a full-stack application designed to download, store, analyze, and display data from the United States eCFR (Electronic Code of Federal Regulations). The application provides a user-friendly interface for exploring regulations, viewing detailed statistics, and gaining insights through data visualizations and an AI-powered assistant.

## 2. System Architecture

The application follows a microservices-oriented architecture, containerized with Docker for consistency and ease of deployment.

*   **Frontend (Client):** A **Next.js** application that provides a dynamic and responsive user interface.
*   **Backend (Server):** A **Node.js/Express** application that serves as the API, handling business logic, data processing, and communication with the database and search engine.
*   **Database:** A **PostgreSQL** database for storing the core regulation data, including titles, chapters, parts, and sections.
*   **Search Engine:** The application leverages **PostgreSQL's** built-in full-text search capabilities.
*   **AI Integration:** The backend integrates with a third-party Large Language Model (LLM) to provide AI-powered features like summarization and a question-answering assistant.

## 3. Backend Design (Node.js & Express)

The backend is responsible for fetching data, managing the database and search index, and exposing a RESTful API for the frontend.

### 3.1. Data Fetching and Storage

The data pipeline is a multi-step process that involves fetching data from the eCFR, processing it, and storing it in the database.

*   **Data Fetching:** The primary method for fetching data is a two-step process:
    1.  The `backend/scripts/download-titles.sh` script downloads all 50 eCFR titles as XML files.
    2.  The `backend/scripts/process-local-data.js` script then parses these local XML files.
*   **Metadata Fetching:** The `backend/scripts/fetch-ecfr-data-v2.js` script is used to fetch metadata such as titles, chapters, and agencies directly from the eCFR API. This script is not used for fetching the full regulation content due to API limitations.
*   **Database Storage:** The processed data, including the full text of regulations and their hierarchical structure, is stored in the PostgreSQL database.
*   **Search Indexing:** The text content of the regulations is indexed in PostgreSQL using a `tsvector` column to enable fast and powerful full-text search.

### 3.2. PostgreSQL Database Schema

The database schema is designed to store the regulations in a structured and hierarchical manner:

*   `titles`: Stores the main titles of the regulations (e.g., `title_number`, `name`).
*   `chapters`: Linked to `titles`, storing the chapters within each title.
*   `parts`: Linked to `chapters`, storing the parts within each chapter.
*   `sections`: Linked to `parts`, storing individual sections. Includes `ecfr_id` and `type` (e.g., 'SECTION', 'SUBPART').
*   `section_versions`: Contains the actual content of each section for a specific `effective_date`. It also stores statistics like `word_count` and `complexity_score`.
*   `agencies`: Stores information about the federal agencies.
*   `agency_cfr_references`: A join table linking `agencies` to the `chapters` they are associated with.

### 3.3. API Endpoints (Express)

The backend provides a comprehensive set of RESTful API endpoints:

*   **Health Check:**
    *   `GET /health`: Checks the health of the backend and its database connection.
*   **Agencies:**
    *   `GET /api/agencies`: Retrieves a list of all agencies.
    *   `GET /api/agencies/:id`: Retrieves details for a specific agency.
    *   `GET /api/agencies/:id/regulations`: Retrieves the regulations associated with a specific agency.
*   **Titles:**
    *   `GET /api/titles`: Retrieves a list of all titles.
    *   `GET /api/titles/:id`: Retrieves details for a specific title.
    *   `GET /api/titles/:id/details`: Retrieves detailed information for a title, including its chapters, parts, sections, and statistics.
*   **Parts & Sections:**
    *   `GET /api/parts/:id`: Retrieves details for a specific part.
    *   `GET /api/sections`: Retrieves a list of all sections.
    *   `GET /api/sections/:id`: Retrieves details for a specific section.
*   **Analytics:**
    *   `GET /api/analytics/complexity`: Calculates the average complexity score.
    *   `GET /api/analytics/amendments`: Calculates the average number of amendments per year.
    *   `GET /api/analytics/regulations-by-agency`: Retrieves the number of regulations per agency.
    *   `GET /api/analytics/complexity-over-time`: Retrieves the average complexity score over time.
    *   `GET /api/analytics/word-count`: Calculates the total word count.
    *   `GET /api/analytics/unique-word-count`: Calculates the total unique word count.
*   **Search:**
    *   `GET /api/search`: Performs a full-text search using PostgreSQL's `to_tsquery` function. Accepts a query parameter `q` and an optional `agencyId`.
*   **AI Chat:**
    *   `POST /api/chat`: Handles interactions with the AI assistant.

## 4. Frontend Design (Next.js)

The frontend is built with Next.js and uses the `app` directory structure for routing and component organization.

### 4.1. Key Pages and Components

*   `app/page.tsx`: The main landing page of the application.
*   `app/explorer/page.tsx`: The main explorer interface for browsing and selecting regulations, including a search bar that interacts with the `/api/search` endpoint.
*   `app/regulations/[id]/page.tsx`: The detail page for a specific regulation, which uses the `RegulationDetail.tsx` component.
*   `app/analytics/page.tsx`: A page for displaying analytics and visualizations.
*   `components/RegulationDetail.tsx`: A client component that displays the details of a selected regulation.
*   `components/AiAssistant.tsx`: A component that provides the chat interface for the AI assistant.

## 5. Robust Searching with PostgreSQL

To provide a powerful and efficient search experience, the application uses PostgreSQL's built-in full-text search capabilities.

*   **Features:** Full-text search, relevance scoring, and fast querying over large volumes of text data using GIN indexes.
*   **Implementation:** The backend uses a `tsvector` column in the `section_versions` table, which is automatically updated by a trigger. The `/api/search` endpoint uses the `to_tsquery` function to perform searches.

## 6. AI-Powered Regulation Assistant

The AI assistant helps users understand complex regulations by answering questions and providing summaries.

*   **Technology:** The backend integrates with the **Google Gemini Pro** model via the `@google/generative-ai` package.
*   **Backend Logic:** The `/api/chat` endpoint constructs prompts based on user input and the context of the current regulation, then sends them to the Gemini API.
*   **Frontend UI:** The `AiAssistant.tsx` component provides a chat interface for users to interact with the AI.

## 7. Containerization with Docker

The entire application is containerized using Docker and managed with Docker Compose.

*   `docker-compose.yml`: Defines the services for the frontend, backend, and database.
*   `Dockerfile`: Separate Dockerfiles for the frontend and backend define the build process for each service.

This setup ensures that the development, testing, and production environments are consistent and easy to manage.
