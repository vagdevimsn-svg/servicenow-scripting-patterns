'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const glide = require('./mocks/glide');
glide.install();
const Router = require('../src/script_includes/VulnRemediationRouter');
global.VulnRemediationRouter = Router;
const executeRule = require('../src/business_rules/assign_remediation_task');

const CI = 'a'.repeat(32);
const tables = { cmdb_ci: [{ sys_id: CI, name: 'lnx-app-01', support_group: 'grp_unix' },
                           { sys_id: 'b'.repeat(32), name: 'no-owner' }] };
const props = { 'x_vuln.routing.fallback_group': 'grp_triage' };
const opened = new Date('2026-10-01T00:00:00Z');

test('riskBand boundaries', () => {
  glide.reset(tables, props);
  const r = new Router();
  assert.equal(r.riskBand('9.0'), 'critical');
  assert.equal(r.riskBand(8.9), 'high');
  assert.equal(r.riskBand(7), 'high');
  assert.equal(r.riskBand(4), 'medium');
  assert.equal(r.riskBand(0.1), 'low');
  for (const bad of ['x', -1, 10.5, null]) assert.equal(r.riskBand(bad), null);
});

test('internet-facing or PCI raises one band, capped at critical', () => {
  const r = new Router();
  assert.equal(r.adjustedBand('medium', { internetFacing: true }), 'high');
  assert.equal(r.adjustedBand('critical', { pciScope: true }), 'critical');
  assert.equal(r.adjustedBand('low', {}), 'low');
});

test('routes to CI support group with SLA due date', () => {
  glide.reset(tables, props);
  const res = new Router().route({ cvss: 9.8, ciSysId: CI, openedAt: opened });
  assert.equal(res.group, 'grp_unix');
  assert.equal(res.band, 'critical');
  assert.equal(res.dueDate.toISOString(), '2026-10-08T00:00:00.000Z');
});

test('falls back to triage group from system property', () => {
  glide.reset(tables, props);
  const r = new Router();
  assert.equal(r.route({ cvss: 5, ciSysId: 'b'.repeat(32), openedAt: opened }).reason, 'CI has no support group');
  assert.equal(r.route({ cvss: 5, ciSysId: 'c'.repeat(32), openedAt: opened }).group, 'grp_triage');
  assert.equal(r.route({ cvss: 5, ciSysId: '', openedAt: opened }).reason, 'no CI');
});

test('invalid CVSS is logged and sent to triage', () => {
  glide.reset(tables, props);
  const res = new Router().route({ cvss: 'n/a', ciSysId: CI, openedAt: opened });
  assert.equal(res.group, 'grp_triage');
  assert.equal(glide.logs.length, 1);
});

test('business rule sets group, due date and work note on current', () => {
  glide.reset(tables, props);
  const values = { u_cvss_score: '7.5', cmdb_ci: CI, u_internet_facing: 'true', u_pci_scope: 'false' };
  const current = { getValue: f => values[f], setValue: (f, v) => { values[f] = v; } };
  executeRule(current, null);
  assert.equal(values.assignment_group, 'grp_unix');
  assert.ok(values.due_date instanceof glide.GlideDateTime);
  assert.match(current.work_notes, /risk band critical/);
});
