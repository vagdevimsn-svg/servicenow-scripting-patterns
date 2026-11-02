/**
 * Scripted REST API resource
 *   API:      CI Health (x_ci_health)   Base path: /api/x_ci_health/v1
 *   Resource: GET /ci/{ci_sys_id}/health
 *   Requires authentication; ACL limits access to the itil and x_ci_health.reader roles.
 *
 * Returns a compact health view of one CI for external dashboards: open incidents by
 * priority, open changes, and whether Discovery has seen the CI recently. Uses GlideAggregate
 * so counts are computed in the database rather than by iterating records.
 */
function ciHealth(request, response) {
    var ciId = request.pathParams.ci_sys_id;
    if (!/^[0-9a-f]{32}$/.test(ciId || '')) {
        response.setStatus(400);
        return { error: 'ci_sys_id must be a 32-character sys_id' };
    }

    var ci = new GlideRecord('cmdb_ci');
    if (!ci.get(ciId) || !ci.canRead()) {
        response.setStatus(404); // same answer for missing and not permitted: no record enumeration
        return { error: 'CI not found' };
    }

    var byPriority = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    var inc = new GlideAggregate('incident');
    inc.addQuery('cmdb_ci', ciId);
    inc.addActiveQuery();
    inc.addAggregate('COUNT');
    inc.groupBy('priority');
    inc.query();
    while (inc.next()) {
        byPriority[inc.getValue('priority')] = parseInt(inc.getAggregate('COUNT'), 10);
    }

    var chg = new GlideAggregate('change_request');
    chg.addQuery('cmdb_ci', ciId);
    chg.addActiveQuery();
    chg.addAggregate('COUNT');
    chg.query();
    var openChanges = chg.next() ? parseInt(chg.getAggregate('COUNT'), 10) : 0;

    var staleDays = parseInt(gs.getProperty('x_ci_health.stale_days', '30'), 10);
    var last = ci.getValue('last_discovered');
    var discoveredRecently = false;
    if (last) {
        var limit = new GlideDateTime();
        limit.addDaysUTC(-staleDays);
        discoveredRecently = new GlideDateTime(last).after(limit);
    }

    return {
        sys_id: ciId,
        name: ci.getValue('name'),
        class: ci.getValue('sys_class_name'),
        open_incidents_by_priority: byPriority,
        open_changes: openChanges,
        discovered_within_days: discoveredRecently ? staleDays : null
    };
}

/* Platform wrapper (what goes in the resource script field):
(function process(request, response) {
    response.setBody(ciHealth(request, response));
})(request, response);
*/

if (typeof module !== 'undefined') module.exports = ciHealth;
