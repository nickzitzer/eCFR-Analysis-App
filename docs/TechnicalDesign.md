# 1. Project Overview

The goal is to build a full-stack application that downloads, stores, analyzes, and displays data from the United States eCFR (Electronic Code of Federal Regulations). The application will feature a robust search engine, advanced data visualizations, and an AI-powered assistant to help users understand complex regulations. It will consist of a Node.js backend, a Next.js frontend, and be containerized with Docker.

# 2. System Architecture

We'll use a microservices-oriented architecture to accommodate the new features:

- **Frontend (Client):** A Next.js application that provides the user interface.
- **Backend (Server):** A Node.js/Express application serving as the primary API gateway. It will handle business logic, user requests, and communication with other services.
- **Database:** A MongoDB database for storing the core regulation data.
- **Search Engine:** An Elasticsearch service for providing advanced, full-text search capabilities.
- **AI Service:** The backend will integrate with a third-party LLM (like the Gemini API) to provide summarization and explanation features.

# 3. Backend Design (Node.js & Express)

The backend will orchestrate data flow between the different parts of the system.

## 3.1. Data Fetching and Indexing

- **Initial Data Download:** The script (`/scripts/fetch-ecfr-data.js`) will now have a two-step process:
  1. Fetch data from the eCFR API and store it in MongoDB.
  2. After storing, push the text data into Elasticsearch for indexing.

- **Data Updates:** The recurring `node-cron` job will update both MongoDB and Elasticsearch to keep them in sync.

## 3.2. MongoDB Database Schema

The schemas for regulations and analysis remain largely the same, but the `analysis` collection will be expanded.

- **`regulations` collection:** (No changes)

- **`analysis` collection (Expanded):**
```json
{
  "_id": "<ObjectId>",
  "regulation_id": "<ObjectId of the regulation>",
  "word_count": 1250,
  "checksum": "<MD5 or SHA256 hash of the text>",
  "complexity_score": 45.5,
  "amendment_frequency": 5,
  "named_entities": {
    "agencies": ["EPA", "Department of Justice"],
    "locations": ["Washington D.C."]
  },
  "custom_metrics": {
    "keyword_frequency": { ... }
  }
}
```

## 3.3. API Endpoints (Express)

The API endpoints will be updated to include search and AI features:

* `GET /api/regulations`: Get a paginated list of regulations (from MongoDB).
* `GET /api/regulations/:id`: Get details of a specific regulation (from MongoDB).
* `GET /api/analysis/:regulation_id`: Get analysis for a regulation (from MongoDB).
* `GET /api/search`: Queries Elasticsearch. Supports parameters like `q`, `page`, and filters.
* `POST /api/ai/summarize`: Sends regulation text to the Gemini API for summarization.
* `POST /api/ai/explain`: Takes a user question and regulation text to get an explanation from Gemini.

# 4. Frontend Design (React Native & Next.js)

The frontend will be enhanced to expose the new features to the user.

## 4.1. Pages and Components

* `pages/index.js`: The main dashboard with a powerful Elasticsearch-backed search bar, filters for agencies, topics, etc.
* `pages/regulations/[id].js`: Regulation detail page will now include:

  * `components/VisualizationDashboard.js`: Displays charts and graphs (e.g., timelines, complexity scores).
  * `components/AiAssistant.js`: Chat-like interface for interacting with the AI assistant.

# 5. Data Analysis & Visualization (Expanded)

## 5.1. Advanced Metrics

* **Readability/Complexity Score:** Use libraries like `text-statistics` (e.g., Flesch-Kincaid).
* **Amendment Frequency:** Analyze the `historical_changes` array.
* **Named Entity Recognition (NER):** Use libraries like `compromise` to extract entities.

## 5.2. Data Visualization

* **Timeline View:** Use `vis-timeline` or a custom component.
* **Bar Charts:** Use `recharts` to compare complexity or keyword frequencies.
* **Network Graph:** Use `d3-force` or `vis-network` to visualize regulatory relationships.

# 6. Robust Searching with Elasticsearch

* **Features:** Full-text search, relevance scoring, faceted search, and typo tolerance.
* **Implementation:** Backend uses official Elasticsearch Node.js client. Frontend hits the `/api/search` endpoint.

# 7. AI-Powered Regulation Assistant

This feature adds intelligence to the application.

* **Technology:** Gemini API for language understanding/generation.

* **Backend Logic:** `/api/ai/*` endpoints handle interactions and prompt construction.

* **Prompt Engineering:**

  * **Summarization Example:**

    ```
    Summarize the following regulation for a small business owner, focusing on key compliance actions: [Regulation Text]
    ```
  * **Explanation Example:**

    ```
    You are a helpful legal assistant. Answer the user's question based on the provided regulation text.
    Question: [User Question]
    Regulation: [Regulation Text]
    ```

* **Frontend UI:** `AiAssistant.js` provides a simple interface, displays streamed AI responses.

# 8. Containerization with Docker (Updated)

# 9. Getting Started: A Step-by-Step Plan (Updated)

1. **Set up Project & Docker:** Run `docker-compose up --build` to launch services.
2. **Initialize Projects:** Set up Node.js and Next.js. Install packages: `@elastic/elasticsearch`, visualization libs, etc.
3. **Build Data Fetching & Indexing Script:** Populate MongoDB and Elasticsearch.
4. **Develop Backend API:** Build endpoints including `/search` and `/ai`.
5. **Develop Frontend UI:** Build visualization and AI components.
6. **Implement Analysis & Search:** Write logic for metrics, integrate Elasticsearch.
7. **Integrate AI Assistant:** Connect frontend to backend AI endpoints and Gemini API.