# Vera AI Merchant Assistant

Vera is an AI-powered merchant assistant built with Node.js, Express,
and the Google Gemini API. It generates personalized merchant messages
from context data and handles merchant replies with rule-based
conversation logic and AI-generated responses.

## Features

-   **Context API:** Stores category, merchant, customer, and trigger
    context in memory.
-   **AI-generated messaging:** Uses Gemini to create personalized
    messages using merchant, category, customer, and trigger
    information.
-   **Trigger processing:** Processes supplied trigger IDs and returns
    messaging actions.
-   **Duplicate-trigger suppression:** Stores processed trigger keys in
    `src/processedTriggers.json` to help prevent duplicate processing
    across server restarts.
-   **Reply handling:** Handles merchant replies, including opt-outs,
    automated replies, requests to follow up later, negative responses,
    and commitment signals.
-   **Health and metadata endpoints:** Provides service health and
    metadata routes.

## Tech Stack

-   Node.js
-   Express
-   Google Gemini API (`@google/genai`)
-   dotenv
-   Python (dataset utilities and judge simulator)

## Project Structure

``` text
vera-ai-assistant/
├── dataset/
│   ├── categories/
│   ├── customers_seed.json
│   ├── merchants_seed.json
│   ├── triggers_seed.json
│   └── generate_dataset.py
├── src/
│   ├── aiService.js
│   ├── api.js
│   ├── processedTriggers.json
│   ├── server.js
│   └── store.js
├── judge_simulator.py
├── package.json
└── README.md
```

## Requirements

-   Node.js and npm
-   A Gemini API key

## Setup

1.  Clone the repository:

    ``` bash
    git clone https://github.com/Aditya-3110/vera-ai-assistant.git
    cd vera-ai-assistant
    ```

2.  Install dependencies:

    ``` bash
    npm install
    ```

3.  Create a `.env` file in the project root:

    ``` env
    GEMINI_API_KEY=your_gemini_api_key
    ```

    Keep `.env` private. Do not commit API keys or other credentials.

4.  Start the development server:

    ``` bash
    npm run dev
    ```

    Or start the server normally:

    ``` bash
    npm start
    ```

The server listens on port `8080`.

## API Endpoints

  -----------------------------------------------------------------------
  Method                  Endpoint                Purpose
  ----------------------- ----------------------- -----------------------
  `GET`                   `/v1/healthz`           Check whether the
                                                  service is running

  `GET`                   `/v1/metadata`          Retrieve service
                                                  metadata

  `POST`                  `/v1/context`           Register or update a
                                                  context object

  `POST`                  `/v1/tick`              Process supplied
                                                  trigger IDs and return
                                                  actions

  `POST`                  `/v1/reply`             Process a merchant
                                                  reply and return the
                                                  next action
  -----------------------------------------------------------------------

### Example: Health check

``` bash
curl http://localhost:8080/v1/healthz
```

### Example: Process a trigger

``` bash
curl -X POST http://localhost:8080/v1/tick \
  -H "Content-Type: application/json" \
  -d '{"available_triggers":["trigger/004"]}'
```

The trigger must have the required context registered through
`/v1/context`.

## Data and Persistence Notes

-   Contexts and conversation histories are currently stored in memory
    and are cleared when the server restarts.
-   Processed trigger keys are saved to `src/processedTriggers.json`.
-   The trigger suppression file contains runtime state. Avoid manually
    editing it while the server is running.
-   AI responses depend on a valid Gemini API key and network access.

## Security

-   Store API keys in environment variables, not in source code.
-   Keep `.env` in `.gitignore`.
-   If a key was committed or exposed, revoke or rotate it and remove it
    from the repository's Git history as appropriate.
-   Never publish API keys in README files, screenshots, logs, or
    commits.

## Development

Run the server in development mode:

``` bash
npm run dev
```

Check the health endpoint:

``` bash
curl http://localhost:8080/v1/healthz
```

## Status

This README documents the current project implementation. Confirm the
official challenge specification and test requirements before treating
the project as submission-ready.
