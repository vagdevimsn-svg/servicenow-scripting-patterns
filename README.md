# servicenow-scripting-patterns

Server-side ServiceNow scripting patterns written the way I would ship them on an instance — a Script Include, a Business Rule and a Scripted REST resource — plus unit tests that run in Node without an instance.

> **Portfolio project.** Independently written examples with synthetic data. Not code from any employer, client or ServiceNow instance. Table and field names prefixed `u_` / `x_` are illustrative.

## What's here

| File | Pattern | Shows |
|---|---|---|
| `src/script_includes/VulnRemediationRouter.js` | Script Include (`Class.create`) | Routing a vulnerability remediation task to the CI's support group, CVSS → risk band, internet-facing/PCI escalation, SLA due date; fallback group in a system property, `gs.warn` on bad input |
| `src/business_rules/assign_remediation_task.js` | *before insert* Business Rule | Calls the Script Include; writes fields on `current` without `current.update()` |
| `src/scripted_rest/ci_health_resource.js` | Scripted REST GET resource | Input validation, `canRead()` check, 404 for both missing and forbidden records, `GlideAggregate` counts grouped by priority, Discovery recency |
| `test/mocks/glide.js` | Test double | Minimal `GlideRecord` / `GlideAggregate` / `GlideDateTime` / `gs` for offline tests |

## Business use case

Vulnerability backlogs grow when findings land in a shared queue and wait for someone to work out who owns the server. Routing on the CI's support group and setting a risk-based due date at creation time means each task reaches the right team immediately and SLA breaches become visible in reporting. The REST resource gives an external dashboard one call to see a CI's open incidents, open changes and Discovery freshness.

## Run the tests

```bash
git clone https://github.com/vagdevimsn-svg/servicenow-scripting-patterns.git
cd servicenow-scripting-patterns
npm test          # Node 18+, no dependencies
```

## Using on a personal developer instance (PDI)

1. Create a scoped app (e.g. `x_vuln`) in Studio / App Engine Studio.
2. Create the Script Include `VulnRemediationRouter` and paste the file contents (drop the `module.exports` line).
3. Add system property `x_vuln.routing.fallback_group` with the sys_id of a triage group.
4. Create the Business Rule on your task table: *before*, *insert*, condition *Assignment group is empty*.
5. For the REST resource, create Scripted REST API `x_ci_health`, resource `GET /ci/{ci_sys_id}/health`, and use the wrapper shown at the bottom of the file. Require authentication and add an ACL.
6. Add Automated Test Framework (ATF) tests for the end-to-end path.

## Design and security choices

- Business logic sits in the Script Include; the Business Rule stays thin.
- *before* rule avoids a second update and recursive rule execution.
- No hard-coded sys_ids; configuration lives in system properties.
- REST resource validates the sys_id format and returns the same 404 for missing and unreadable records, so it cannot be used to probe which CIs exist.
- Aggregates run in the database (`GlideAggregate`), not in a JavaScript loop over records.

## Limitations

- The mocks cover only the API surface used here; they are not a platform emulator. ATF on a real instance is still needed.
- SLA windows are illustrative policy values.

## License

MIT
