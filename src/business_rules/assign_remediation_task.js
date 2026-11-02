/**
 * Business Rule: Assign remediation task
 * Table: sn_vul_remediation_task (or a custom task table in a PDI)
 * When: before, Insert   Condition: assignment_group is empty
 *
 * A *before* rule is used so the values are written in the same database operation
 * (no current.update(), which would re-trigger rules).
 */
function executeRule(current, previous /* null when async */) {
    var router = new VulnRemediationRouter('BR assign remediation');
    var result = router.route({
        cvss: current.getValue('u_cvss_score'),
        ciSysId: current.getValue('cmdb_ci'),
        internetFacing: current.getValue('u_internet_facing') === 'true',
        pciScope: current.getValue('u_pci_scope') === 'true',
        openedAt: new Date()
    });

    current.setValue('assignment_group', result.group);
    if (result.dueDate) {
        var gdt = new GlideDateTime();
        gdt.setValue(result.dueDate.toISOString().replace('T', ' ').substring(0, 19));
        current.setValue('due_date', gdt);
    }
    current.work_notes = 'Auto-routed: ' + result.reason + (result.band ? ', risk band ' + result.band : '');
}

if (typeof module !== 'undefined') module.exports = executeRule;
