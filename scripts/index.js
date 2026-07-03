export default {

  async fetch(request, env) {
    console.log(request);
    try {
        const response = await env.GET_GITHUB_JSON.fetch();
        if (!response.ok) { throw new Error(`Worker responded with status: ${response.status}`); }

        const githubValue = await response.json();
        
        return new Response(JSON.stringify(githubValue, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", 
            },
        });

    } catch (error) {
        console.error("Failed to load GitHub data:", error.message);
    }
  },
  
};