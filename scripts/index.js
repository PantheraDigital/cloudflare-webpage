export default {

  async fetch(request, env) {
    try {
        const response = await env.GET_GITHUB_JSON.fetch();
        if (!response.ok) { throw new Error(`Worker responded with status: ${response.status}`); }

        const githubValue = await response.json();
        console.log(githubValue);
        
    } catch (error) {
        console.error("Failed to load GitHub data:", error.message);
    }
    return env.ASSETS.fetch(request);
  }
  
}
