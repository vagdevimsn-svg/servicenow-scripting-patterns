/**
 * Tiny in-memory stand-ins for GlideRecord, GlideAggregate, GlideDateTime and gs so
 * platform scripts can be unit tested with node:test. Only the methods used in /src are
 * implemented. This is a test double, not a re-implementation of the platform.
 */
'use strict';

const db = {};
const props = {};
const logs = [];

function reset(tables = {}, properties = {}) {
  for (const k of Object.keys(db)) delete db[k];
  for (const k of Object.keys(props)) delete props[k];
  Object.assign(db, JSON.parse(JSON.stringify(tables)));
  Object.assign(props, properties);
  logs.length = 0;
}

class GlideRecord {
  constructor(table) { this.table = table; this._rows = []; this._i = -1; this._q = []; this._row = null; }
  get(sysId) { this._row = (db[this.table] || []).find(r => r.sys_id === sysId) || null; return !!this._row; }
  getValue(f) { return this._row && this._row[f] != null ? String(this._row[f]) : null; }
  canRead() { return !(this._row && this._row._denied); }
  addQuery(f, v) { this._q.push(r => String(r[f]) === String(v)); }
  addActiveQuery() { this._q.push(r => r.active !== false); }
  query() { this._rows = (db[this.table] || []).filter(r => this._q.every(fn => fn(r))); this._i = -1; }
  next() { this._i++; this._row = this._rows[this._i] || null; return !!this._row; }
}

class GlideAggregate extends GlideRecord {
  constructor(table) { super(table); this._group = null; }
  addAggregate() {}
  groupBy(f) { this._group = f; }
  query() {
    super.query();
    const buckets = new Map();
    for (const r of this._rows) {
      const key = this._group ? String(r[this._group]) : '_all';
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    this._rows = [...buckets.entries()].map(([k, n]) => ({ [this._group || '_k']: k, _count: n }));
    this._i = -1;
  }
  getAggregate() { return String(this._row._count); }
}

class GlideDateTime {
  constructor(v) { this._d = v ? new Date(String(v).replace(' ', 'T') + 'Z') : new Date(); }
  setValue(v) { this._d = new Date(String(v).replace(' ', 'T') + 'Z'); }
  addDaysUTC(n) { this._d = new Date(this._d.getTime() + n * 86400000); }
  after(o) { return this._d.getTime() > o._d.getTime(); }
  getDate() { return this._d; }
  toString() { return this._d.toISOString().replace('T', ' ').substring(0, 19); }
}

const gs = {
  getProperty: (k, d) => (k in props ? props[k] : d),
  warn: m => logs.push(['warn', m]),
  info: m => logs.push(['info', m]),
};

function install() {
  Object.assign(global, { GlideRecord, GlideAggregate, GlideDateTime, gs });
  global.Class = { create: () => function () { this.initialize.apply(this, arguments); } };
}

module.exports = { install, reset, logs, GlideDateTime };
