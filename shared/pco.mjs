// Planning Center API client — a faithful JS port of the original pco_client.py.
// Uses Basic auth (App ID + Secret), retries on 429 honouring Retry-After, and
// follows `links.next` pagination. Runs on Node 18+ (global fetch).

const SERVICES_URL = "https://api.planningcenteronline.com/services/v2";
const PEOPLE_URL = "https://api.planningcenteronline.com/people/v2";
const GROUPS_URL = "https://api.planningcenteronline.com/groups/v2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class PCOClient {
  constructor(appId = process.env.PCO_APP_ID, secret = process.env.PCO_SECRET) {
    if (!appId || !secret) {
      throw new Error("PCO_APP_ID and PCO_SECRET must be set in the environment");
    }
    this.auth = "Basic " + Buffer.from(`${appId}:${secret}`).toString("base64");
  }

  // Single GET with automatic retry on 429 (respects Retry-After).
  async _get(url) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const resp = await fetch(url, { headers: { Authorization: this.auth } });
      if (resp.status === 429) {
        const wait = parseInt(resp.headers.get("Retry-After") || "20", 10);
        await sleep(wait * 1000);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`PCO ${resp.status} ${resp.statusText} for ${url}`);
      }
      return resp.json();
    }
    throw new Error(`PCO request failed after retries: ${url}`);
  }

  // Follows pagination, returning the concatenated `data` arrays.
  async _getAll(baseUrl, params = {}) {
    const usp = new URLSearchParams({ ...params, per_page: "100" });
    let url = `${baseUrl}?${usp.toString()}`;
    const results = [];
    while (url) {
      const body = await this._get(url);
      if (Array.isArray(body.data)) results.push(...body.data);
      url = body.links?.next || null;
      if (url) await sleep(250); // ~4 req/s, inside PCO's 100/20s limit
    }
    return results;
  }

  getCampuses() {
    return this._getAll(`${PEOPLE_URL}/campuses`);
  }
  getServiceTypes() {
    return this._getAll(`${SERVICES_URL}/service_types`);
  }
  getTeams(serviceTypeId) {
    return this._getAll(`${SERVICES_URL}/service_types/${serviceTypeId}/teams`);
  }
  getTeamPeople(teamId) {
    return this._getAll(`${SERVICES_URL}/teams/${teamId}/people`);
  }
  getPlans(serviceTypeId) {
    return this._getAll(`${SERVICES_URL}/service_types/${serviceTypeId}/plans`);
  }
  getPlanTeamMembers(planId) {
    return this._getAll(`${SERVICES_URL}/plans/${planId}/team_members`);
  }

  // People: Forms
  getFormSubmissions(formId) {
    return this._getAll(`${PEOPLE_URL}/forms/${formId}/form_submissions`, { include: "person" });
  }
  async getPersonCampus(personId) {
    const body = await this._get(
      `${PEOPLE_URL}/people/${personId}?include=primary_campus`
    );
    const rel = body?.data?.relationships?.primary_campus?.data;
    return rel ? rel.id : null;
  }

  // Groups
  getGroupTypes() {
    return this._getAll(`${GROUPS_URL}/group_types`);
  }
  getGroups(groupTypeId) {
    return this._getAll(`${GROUPS_URL}/group_types/${groupTypeId}/groups`);
  }
  getGroupMemberships(groupId) {
    return this._getAll(`${GROUPS_URL}/groups/${groupId}/memberships`);
  }
}
