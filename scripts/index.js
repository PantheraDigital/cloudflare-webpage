export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let githubValue = null;

    if (url.pathname === "/scripts/frontend.js") {
      try {
          const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
          if (response.ok) { 
              githubValue = await response.json(); 
          }
      } catch (error) {
          console.error("Failed to load GitHub data inside worker:", error.message);
      }

      const assetResponse = await env.ASSETS.fetch(request);

      if (githubValue) {
          let jsText = await assetResponse.text();
          
          jsText = jsText.replace("INITIAL_DATA_PLACEHOLDER", JSON.stringify(githubValue));
          return new Response(jsText, {
              headers: { "content-type": "application/javascript;charset=UTF-8" }
          });
      }
    }

    return env.ASSETS.fetch(request);
  }
}
