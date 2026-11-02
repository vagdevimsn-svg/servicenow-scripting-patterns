'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const glide = require('./mocks/glide');
glide.install();
const ciHealth = require('../src/scripted_rest/ci_health_resource');

const CI = 'd'.repeat(32);
const recent = new Date(Date.now() - 2 * 86400000).toISOString().replace('T', ' ').substring(0, 19);
const tables = {
  cmdb_ci: [{ sys_id: CI, name: 'paydb01', sys_class_name: 'cmdb_ci_db_instance', last_discovered: recent },
            { sys_id: 'e'.repeat(32), name: 'secret', _denied: true }],
  incident: [{ cmdb_ci: CI, priority: 1 }, { cmdb_ci: CI, priority: 3 }, { cmdb_ci: CI, priority: 3 },
             { cmdb_ci: CI, priority: 2, active: false }, { cmdb_ci: 'other', priority: 1 }],
  change_request: [{ cmdb_ci: CI }],
};

function call(id) {
  const res = { status: 200, setStatus(s) { this.status = s; } };
  return { body: ciHealth({ pathParams: { ci_sys_id: id } }, res), status: res.status };
}

test('returns aggregated health for a readable CI', () => {
  glide.reset(tables, {});
  const { body, status } = call(CI);
  assert.equal(status, 200);
  assert.deepEqual(body.open_incidents_by_priority, { 1: 1, 2: 0, 3: 2, 4: 0, 5: 0 });
  assert.equal(body.open_changes, 1);
  assert.equal(body.discovered_within_days, 30);
});

test('rejects malformed sys_id with 400', () => {
  glide.reset(tables, {});
  assert.equal(call("x' OR 1=1").status, 400);
});

test('missing and unreadable CIs both return 404', () => {
  glide.reset(tables, {});
  assert.equal(call('f'.repeat(32)).status, 404);
  assert.equal(call('e'.repeat(32)).status, 404);
});
