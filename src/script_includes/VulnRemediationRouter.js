/**
 * Script Include: VulnRemediationRouter
 * Accessible from: This application scope only
 *
 * Decides the assignment group and SLA due date for a vulnerability remediation task
 * using the affected CI's support group and the CVSS score. Pure decision logic lives in
 * small methods so it can be unit tested outside the platform.
 *
 * Portfolio example: independently written, not taken from any employer or client instance.
 */
var VulnRemediationRouter = Class.create();
VulnRemediationRouter.prototype = {
    // Remediation windows in days by risk band (illustrative policy, not a client's).
    SLA_DAYS: { critical: 7, high: 30, medium: 60, low: 90 },
    initialize: function (logSource) {
        this.logSource = logSource || 'VulnRemediationRouter';
        // sys_id of the triage group, kept in a system property instead of hard-coded
        this.FALLBACK_GROUP = gs.getProperty('x_vuln.routing.fallback_group', '');
    },

    /** CVSS v3 base score -> risk band. Returns null for invalid input. */
    riskBand: function (cvss) {
        var score = parseFloat(cvss);
        if (isNaN(score) || score < 0 || score > 10) return null;
        if (score >= 9.0) return 'critical';
        if (score >= 7.0) return 'high';
        if (score >= 4.0) return 'medium';
        return 'low';
    },

    /**
     * Internet-facing or PCI-scoped CIs move up one band, never above critical.
     */
    adjustedBand: function (band, ciFlags) {
        var order = ['low', 'medium', 'high', 'critical'];
        var idx = order.indexOf(band);
        if (idx < 0) return null;
        if (ciFlags && (ciFlags.internetFacing || ciFlags.pciScope)) idx = Math.min(idx + 1, order.length - 1);
        return order[idx];
    },

    /** Looks up the CI and returns its support group sys_id, or the fallback group name. */
    resolveGroup: function (ciSysId) {
        if (!ciSysId) return { group: this.FALLBACK_GROUP, reason: 'no CI' };
        var ci = new GlideRecord('cmdb_ci');
        if (!ci.get(ciSysId)) return { group: this.FALLBACK_GROUP, reason: 'CI not found' };
        var grp = ci.getValue('support_group');
        if (!grp) return { group: this.FALLBACK_GROUP, reason: 'CI has no support group' };
        return { group: grp, reason: 'CI support group' };
    },

    /**
     * Main entry point. Returns a plain object; callers decide whether to write it.
     * @param {Object} input {cvss, ciSysId, internetFacing, pciScope, openedAt (Date)}
     */
    route: function (input) {
        var band = this.adjustedBand(this.riskBand(input.cvss), input);
        if (!band) {
            gs.warn('[' + this.logSource + '] invalid CVSS "' + input.cvss + '"; sent to triage');
            return { group: this.FALLBACK_GROUP, band: null, dueDate: null, reason: 'invalid CVSS' };
        }
        var grp = this.resolveGroup(input.ciSysId);
        var due = new Date(input.openedAt.getTime() + this.SLA_DAYS[band] * 24 * 60 * 60 * 1000);
        return { group: grp.group, band: band, dueDate: due, reason: grp.reason };
    },

    type: 'VulnRemediationRouter'
};

if (typeof module !== 'undefined') module.exports = VulnRemediationRouter;
