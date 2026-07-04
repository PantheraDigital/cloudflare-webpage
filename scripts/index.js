export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname !== "/" && url.pathname !== "/index.html") {
            return env.ASSETS.fetch(request);
        }

        let githubValue = null;
        try {
            const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
            if (!response.ok) throw new Error(`GitHub data retrieval failed. Status: ${response.status}`);
            githubValue = await response.json();
        } catch (error) {
            console.error("Failed to load GitHub data:", error.message);
        }

        try {
            const assetResponse = await env.ASSETS.fetch(request);
            let htmlText = await assetResponse.text();
            
            htmlText = htmlText.replace("GITHUB_DATA_PLACEHOLDER", (githubValue) ? JSON.stringify(githubValue) : "{}");
            return new Response(htmlText, {
                headers: { "content-type": "text/html;charset=UTF-8" }
            });
        } catch (error) {
            console.error("Data injection failed, serving original file:", error.message);
        }
        
        return env.ASSETS.fetch(request);
    }
}
