# eCFR Analysis App

This is a full-stack web application designed to help users explore, analyze, and visualize Federal Regulations from the Electronic Code of Federal Regulations (eCFR).

## Features

*   **Regulation Explorer**: Browse and search for regulations by title, chapter, part, and section.
*   **Detailed Regulation View**: View the full text of regulations, along with key statistics and a hierarchical breakdown.
*   **Data Visualizations**: Explore interactive visualizations of regulation data.
*   **AI-Powered Assistant**: Get help and insights from an AI-powered chatbot.
*   **Data Fetching**: Scripts to fetch and update regulation data from the eCFR.

## Tech Stack

*   **Frontend**:
    *   [Next.js](https://nextjs.org/) - React framework for building user interfaces.
    *   [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework.
    *   [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript.
*   **Backend**:
    *   [Node.js](https://nodejs.org/) - JavaScript runtime environment.
    *   [Express](https://expressjs.com/) - Web framework for Node.js.
    *   [PostgreSQL](https://www.postgresql.org/) - Relational database.
*   **Containerization**:
    *   [Docker](https://www.docker.com/) - Platform for developing, shipping, and running applications in containers.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later)
*   [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation and Setup

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd ecfr-analysis-app
    ```

2.  **Set up environment variables:**

    Create a `.env` file in the root of the project by copying the example file:

    ```bash
    cp .env.example .env
    ```

    Update the `.env` file with your database credentials and any other necessary configurations.

3.  **Build and run the application with Docker Compose:**

    **Note:** You must complete step 1 of data initialization prior to running this command.

    ```bash
    docker-compose up --build
    ```

    This will build the Docker images for the frontend and backend services and start the containers.

    *   The frontend will be available at [http://localhost:3000](http://localhost:3000).
    *   The backend server will be running on port 3001.

## Data Initialization

To use the application, you first need to populate the database with eCFR data.

This three-step process ensures you have all the necessary data, including the full text of regulations.

**Step 1: Download eCFR Data as XML Files**

This script downloads all 50 titles from the eCFR website for a specific date and saves them as XML files in the `docs` directory. **Note:** This must be done prior to composing the docker environment.

```bash
sh ./backend/scripts/download-titles.sh
```

**Step 1: Fetching Metadata First**

This method fetches only the high-level structure, such as titles, chapters, and agencies, from the eCFR API.

**Note:** This script does **not** fetch the full text of the regulations due to API limitations and timeouts. It is useful for quickly setting up the basic structure of the database.

```bash
docker-compose exec backend npm run fetch-data
```

**Step 3: Process Local XML Files**

This script parses the downloaded XML files, extracts the content, and populates the PostgreSQL database.

```bash
docker-compose exec backend npm run process-local
```

### A Note on Historical Data

There is a script available to fetch historical eCFR data (`fetch-historical-data`), but it is subject to the same API timeout issues as the `fetch-data` script and is not recommended for general use. For a complete historical import, you would need to acquire the data through other means and adapt the processing scripts. See `backend/scripts/download-titles.sh` for example on how to import historic data.
