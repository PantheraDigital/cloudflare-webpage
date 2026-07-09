function projectTemplate({ title, link, imgSrc, imgDes, tags, description }) {
    const tagsText = tags && tags.length > 0 ? `tags: ${tags.join(', ')}` : '';
    return `
    <details class="project-details" data-tags="${tagsText ? tagsText : ''}">
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
            let count = 0;
            for (const entryKey in githubValue.Projects){
                descJSON[count] = githubValue.Projects[entryKey].description;
                if (count === 1) {console.log("MD Sample", descJSON[count]);}
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
                if (count === 1) {console.log("HTML Sample", githubValue.Projects[entryKey]);}
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
            //htmlText = htmlText.replace("GITHUB_DATA_PLACEHOLDER", (githubValue) ? JSON.stringify(githubValue) : "{}"); 
            
            let count = 0;
            // Projects
            const entryArray = [];
            for (const entryKey in githubValue.Projects){
                const entry = githubValue.Projects[entryKey];

                entryArray.push(projectTemplate({
                    title: entryKey,
                    link: entry.link,
                    imgSrc: entry.imgSrc,
                    imgDes: entry.imgDes,
                    tags: entry.tags,
                    description: entry.description
                }));
                if (count === 1) {console.log("HTML Template Sample", entryArray);}
                count += 1;
            }
            htmlText = htmlText.replace("<!--placeholder-projects-data-->", entryArray.join('\n'));
            
            // Posts
            entryArray.length = 0;
            for (const entryKey in githubValue.Posts){
                const entry = githubValue.Posts[entryKey];
                
                entryArray.push(projectTemplate({
                    title: entryKey,
                    link: entry.link,
                    imgSrc: entry.imgSrc,
                    imgDes: entry.imgDes,
                    tags: entry.tags,
                    description: entry.description
                }));
            }
            htmlText = htmlText.replace("<!--placeholder-posts-data-->", entryArray.join('\n'));

            return new Response(htmlText, {
                headers: { "Content-Type": "text/html;charset=UTF-8" }
            });
        } catch (error) {
            console.error("Data injection failed, serving original file:", error.message);
        }
        
        return env.ASSETS.fetch(request);
    }
}
