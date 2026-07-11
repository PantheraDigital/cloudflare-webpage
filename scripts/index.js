function projectTemplate({ entryGroup, entryIndex, title, link, imgSrc, imgDes, tags, description }) {
    const tagsText = tags && tags.length > 0 ? `tags: ${tags.join(', ')}` : '';
    return `
    <details class="project-details" name="${entryGroup}" data-tags="${tags ? tags : ''}" data-original-index="${entryIndex}">
        <summary>${title}</summary>
        <div class="project-body">
            ${imgSrc ? `<img src="${imgSrc}" alt="${imgDes}" loading="lazy"><br>` : ''}
            ${link ? `<a href="${link}" aria-label="Project Link">${link}</a>` : ''}
            ${description ? description : ''}
            ${tagsText ? `<p name="tags">${tagsText}</p>` : ''}
        </div>
    </details>`;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (url.pathname !== "/" && url.pathname !== "/index.html") {
            return env.ASSETS.fetch(request);
        }

        try{ // get stored html render if fresh
            const htmlCacheFresh = await env.WEBPAGE_KV.get("html_render_fresh");
            if (htmlCacheFresh && htmlCacheFresh === "true") {
                const htmlRender = await env.WEBPAGE_KV.get("html_render");
                return new Response(htmlRender, {
                    headers: { "Content-Type": "text/html;charset=UTF-8" }
                });
            } // fresh only set false if MD file updated, html update does not trigger unfresh
        } catch(error) {
            console.error("failed to retrieve KV cache data:", error.message);
        }

        let githubValue = null;
        try {
            const response = await env.GET_GITHUB_JSON.fetch("https://dummy/");
            if (!response.ok) throw new Error(`GitHub data retrieval failed. Status: ${response.status}`);
            githubValue = await response.json();
        } catch (error) {
            console.error("Failed to load GitHub data:", error.message);
        }

        if (!githubValue) { return env.ASSETS.fetch(request); }

        try{
            // gather MD descriptions
            let descJSON = {};
            let count = 0; // object needs to be flat, count prevents key collision
            for (const entryKey in githubValue.Projects){
                descJSON[count] = githubValue.Projects[entryKey].description;
                count += 1;
            }
            for (const entryKey in githubValue.Posts){
                descJSON[count] = githubValue.Posts[entryKey].description;
                count += 1;
            }

            // batch convert MD to HTML
            const response = await env.MARKDOWN_TO_HTML.fetch("https://dummy/", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(descJSON),
            });
            if (!response.ok) throw new Error(`MARKDOWN_TO_HTML data retrieval failed. Status: ${response.status}`);
            
            // reassign descriptions to HTML
            let htmlDescJson = await response.json();
            count = 0;
            for (const entryKey in githubValue.Projects){
                githubValue.Projects[entryKey].description = htmlDescJson[count];
                count += 1;
            }
            for (const entryKey in githubValue.Posts){
                githubValue.Posts[entryKey].description = htmlDescJson[count];
                count += 1;
            }
        } catch (error) {
            console.error("Failed to convert MD to HTML:", error.message);
            return env.ASSETS.fetch(request);
        }

        try {
            const assetResponse = await env.ASSETS.fetch(request);
            let htmlText = await assetResponse.text();
            
            // Projects
            const entryArray = [];
            let index = 0;
            for (const entryKey in githubValue.Projects){
                const entry = githubValue.Projects[entryKey];

                entryArray.push(projectTemplate({
                    entryGroup: "projects",
                    entryIndex: index,
                    title: entryKey,
                    link: entry.link,
                    imgSrc: entry.imgSrc,
                    imgDes: entry.imgDes,
                    tags: entry.tags,
                    description: entry.description
                }));
                index += 1;
            }
            htmlText = htmlText.replace("<!--placeholder-projects-data-->", entryArray.join('\n'));
            
            // Posts
            entryArray.length = 0;
            for (const entryKey in githubValue.Posts){
                const entry = githubValue.Posts[entryKey];
                
                entryArray.push(projectTemplate({
                    entryGroup: "posts",
                    entryIndex: index,
                    title: entryKey,
                    link: entry.link,
                    imgSrc: entry.imgSrc,
                    imgDes: entry.imgDes,
                    tags: entry.tags,
                    description: entry.description
                }));
                index += 1;
            }
            htmlText = htmlText.replace("<!--placeholder-posts-data-->", entryArray.join('\n'));

            ctx.waitUntil(
                Promise.all([
                    env.WEBPAGE_KV.put("html_render", htmlText),
                    env.WEBPAGE_KV.put("html_render_fresh", "true")
                ]).catch(err => console.error("Failed store html render:", err.message))
            );
            return new Response(htmlText, {
                headers: { "Content-Type": "text/html;charset=UTF-8" }
            });
        } catch (error) {
            console.error("Data injection failed, serving original file:", error.message);
        }
        
        return env.ASSETS.fetch(request);
    }
}
