import { WorkerEntrypoint } from "cloudflare:workers";

export default class extends WorkerEntrypoint {

  async fetch(request, env) {
    /*
    try {
        const response = await env.GET_GITHUB_JSON.fetch();
        if (!response.ok) { throw new Error(`Worker responded with status: ${response.status}`); }

        const githubValue = await response.json();
        
    } catch (error) {
        console.error("Failed to load GitHub data:", error.message);
    }
    */
    return this.env.ASSETS.fetch(request);
  }
  
}
