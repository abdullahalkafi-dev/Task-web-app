# Dayflow documentation

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Components, ownership, data flow, auth and sync |
| [API specification](API_SPEC.md) | Endpoint contracts and authentication |
| [Database schema](DATABASE_SCHEMA.md) | Data, indexes and desktop handoff expiry |
| [Desktop guide](DESKTOP.md) | Installation, development, packaging, native boundaries, upgrades and troubleshooting |
| [Desktop completion/verification](DESKTOP_IMPLEMENTATION_PLAN.md) | Implemented scope, test results and manual-check limits |
| [Engineering audit log](AUDIT_LOG.md) | Dated decisions, commits, installer fingerprints, deployments and feedback |
| [Deployment runbook](../deploy/README.md) | Server operations, backup/restore and rollback |
| [Original implementation history](IMPLEMENTATION_PLAN.md) | Earlier web milestones, including approaches since superseded |

## Future change workflow

1. Read the current architecture and relevant contracts. Preserve shared task/note logic; native features belong in the desktop package.
2. Identify the affected deliverables: hosted frontend/backend, native installer, database/indexes, proxy configuration or docs only.
3. Update the relevant guide/contracts and append an audit entry with the reason, changed behavior and compatibility decisions.
4. Run appropriate checks. Record actual commands/results and checks not run. Browser and desktop E2E suites share local ports, so run them sequentially.
5. For native releases, bump the desktop manifest/lockfile version together, build the installer and record filename, size and SHA-256. Preserve the application identity and persistent partition.
6. For server releases, follow the runbook, retain the previous commit/backups, and record the deployed revision and post-deploy checks.
7. Record user feedback separately from automated evidence. A general success report does not establish that every manual scenario passed.

Documentation-only updates need content/link checks, not an application rebuild. Never copy tokens, Google credentials, environment secrets or personal content into audit entries. Generated installers, traces and screenshots are ignored by Git; archive binaries and raw evidence separately when long-term retention is required.
