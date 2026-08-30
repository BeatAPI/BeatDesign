# Security policy

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities. Use the repository's GitHub Security Advisory reporting flow so maintainers can investigate before disclosure.

Include the affected route or component, reproduction steps, impact, and any suggested mitigation. Do not include real API keys, storage credentials, private media, or customer data.

## Deployment responsibility

BeatDesign is a single-user, local-first application and does not include authentication. The development server binds to localhost and is not designed to be exposed as a hosted multi-user service. Provider and optional storage credentials are encrypted in the local SQLite workspace.

The maintainers support the latest released `0.2.x` version. Security fixes are published in the next patch release when possible.
