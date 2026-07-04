export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname === "/scripts/frontend.js") {
            try {
                const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
                if (!response.ok) throw new Error(`GitHub API failed. Status: ${response.status}`);
                
                const githubValue = await response.json();
                const assetResponse = await env.ASSETS.fetch(request);
                let jsText = await assetResponse.text();
                
                jsText = jsText.replace("INITIAL_DATA_PLACEHOLDER", JSON.stringify(githubValue));
                
                return new Response(jsText, {
                    headers: { "content-type": "application/javascript;charset=UTF-8" }
                });
            } catch (error) {
                console.error("Data injection failed, serving original file:", error.message);
                return env.ASSETS.fetch(request);
            }
        }

        return env.ASSETS.fetch(request);
    }
}
