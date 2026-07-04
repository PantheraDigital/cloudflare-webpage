export default {

  async fetch(request, env) {
    try {
        const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
        if (!response.ok) { throw new Error(`Worker responded with status: ${response.status}`); }

        const githubValue = await response.json();
        console.log(githubValue);
        
    } catch (error) {
        console.error("Failed to load GitHub data:", error.message);
    }
    return env.ASSETS.fetch(request);
  }
  
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        let githubValue = null;
        
        if (url.pathname === "/scripts/frontend.js") {
            try {
                const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
                if (!response.ok) {
                    throw new Error(`Worker responded with status: ${response.status}`);
                }
                githubValue = await response.json();
            } catch (error) {
                console.error("Failed to load GitHub data:", error.message);
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


export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname !== "/scripts/frontend.js") {
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
            let jsText = await assetResponse.text();
            
            jsText = jsText.replace("INITIAL_DATA_PLACEHOLDER", (githubValue) ? JSON.stringify(githubValue) : "{}");
            return new Response(jsText, {
                headers: { "content-type": "application/javascript;charset=UTF-8" }
            });
        } catch (error) {
            console.error("Data injection failed, serving original file:", error.message);
        }
        
        return env.ASSETS.fetch(request);
    }
}


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
                headers: { "content-type": "application/javascript;charset=UTF-8" }
            });
        } catch (error) {
            console.error("Data injection failed, serving original file:", error.message);
        }
        
        return env.ASSETS.fetch(request);
    }
}