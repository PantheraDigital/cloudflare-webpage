export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        let githubValue = null;
        console.log(url);
        if (url.pathname === "/scripts/frontend.js") {
            console.log("intercept");
            try {
                const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
                if (!response.ok) {
                    throw new Error(`Worker responded with status: ${response.status}`);
                }
                githubValue = await response.json();
                console.log(githubValue);
            } catch (error) {
                console.error("Failed to load GitHub data:", error.message);
            }

            const assetResponse = await env.ASSETS.fetch(request);

            if (githubValue) {
                let jsText = await assetResponse.text();
                jsText = jsText.replace("INITIAL_DATA_PLACEHOLDER", JSON.stringify(githubValue));
                console.log(jsText);
                return new Response(jsText, {
                    headers: { "content-type": "application/javascript;charset=UTF-8" }
                });
            } else {
                console.log("githubValue false");
            }
        }

        return env.ASSETS.fetch(request);
    }
}
