export default {

  async fetch(request, env) {
    console.log(request);
    try {
        const response = await env.GET_GITHUB_JSON.fetch();
        if (!response.ok) { throw new Error(`Worker responded with status: ${response.status}`); }

        const githubValue = await response.json();
        
        return env.ASSETS.fetch(request);

    } catch (error) {
        console.error("Failed to load GitHub data:", error.message);
    }
  },
  
};
