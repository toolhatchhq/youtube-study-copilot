# AI Stack

## Research Date

- March 26, 2026

## Candidate Tools And Models

- Chrome Prompt API for on-device generation when supported
- OpenAI frontier reasoning and coding models for research, implementation, evals, and possible future cloud fallback
- tool-enabled agents for system inspection, research synthesis, and repeatable launch workflows

## Chosen Stack

- product runtime: Chrome Prompt API first, heuristic fallback today
- research workflow: latest web-enabled research model plus official docs and live web sources
- implementation workflow: latest coding-focused agentic model for code changes and automation

## Why This Stack

- Prompt API keeps margin high when it works and supports a privacy-friendly story
- local fallback keeps the product useful even without browser-native AI availability
- web-enabled frontier models are necessary because competitor landscape, pricing, Chrome policies, and model options change quickly

## Risks And Fallbacks

- Prompt API hardware limits reduce total user coverage
- cloud fallback is still an open future option if conversion justifies the cost
- AI research choices must be refreshed at the start of each new product sprint, not copied blindly from old decisions
