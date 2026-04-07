# Snowplow Agentic App Tracking Demo

A travel booking chatbot that demonstrates how to instrument AI-powered applications with [Snowplow](https://snowplow.io/) behavioral data tracking across three architectural layers: client-side, server-side, and agent self-tracking.

This repository is the companion code for the [Snowplow Agentic Tracking Accelerator](https://docs.snowplow.io/tutorials/agentic-self-tracking/introduction/) tutorial. Each git tag represents a stage in the tutorial, progressively adding tracking from zero to full implementation.

## Tags

| Tag | Description |
|---|---|
| `v0.0-starter` | Fully functional travel chatbot with zero Snowplow tracking |
| `v0.1-client-tracking` | Browser-side Snowplow tracking for user interactions |
| `v0.2-server-tracking` | Server-side tracking for agent orchestration and tool execution |
| `v0.3-agentic-tracking` | Agent self-tracking tools — complete implementation |

## Tech Stack

- **Frontend**: Next.js, React 19, TypeScript, Tailwind CSS
- **AI**: Multi-provider support via Vercel AI SDK (Anthropic, OpenAI, Google)
- **Tracking**: Snowplow Browser Tracker + Node Tracker (added progressively)
- **Validation**: Snowplow Micro (Docker) for local event validation

## Prerequisites

- Node.js 18+
- At least one LLM API key (Anthropic, OpenAI, or Google)
- Docker (required from v0.1 onwards for Snowplow Micro)

## Quick Start

```bash
# Clone and checkout a tag
git clone https://github.com/snowplow-industry-solutions/agentic-app-tracking-tutorial.git
cd agentic-app-tracking-tutorial
git checkout v0.0-starter  # or any tag

# Install dependencies
npm install

# Create your environment file
cp .env.example .env.local
# Edit .env.local with your API key(s)

# Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the travel assistant.

## How It Works

The app is an AI-powered travel assistant that can:
- Search for flights between cities
- Book flights for passengers
- Check calendar availability

Users can select between multiple AI providers (Anthropic Claude, OpenAI GPT, Google Gemini) via a dropdown in the UI. The model selection persists across sessions.

## License

Apache-2.0
