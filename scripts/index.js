function projectTemplate({ entryGroup, entryIndex, title, link, imgSrc, imgDes, tags, description }) {
    const tagsText = tags && tags.length > 0 ? `tags: ${tags.join(', ')}` : '';
    const tagsData = tags && tags.length > 0 ? tags.join(',') : '';
    return `
    <details class="project-details" name="${entryGroup}" data-tags="${tagsData}" data-original-index="${entryIndex}">
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
    async fetch(request, env, ctx) {
    const url = new URL(request.url);
        if (url.pathname !== "/" && url.pathname !== "/index.html") {
            return env.ASSETS.fetch(request);
        }

        try {
            const isFresh = await env.WEBPAGE_KV.get("html_render_fresh");
            const cachedRenderedHTML = await env.WEBPAGE_KV.get("html_render");

            if (isFresh === "true" && cachedRenderedHTML) {
                return new Response(cachedRenderedHTML, {
                    headers: { "Content-Type": "text/html;charset=UTF-8" }
                });
            }

            let [cachedJSON, rawLayoutHTML] = await Promise.all([
                env.WEBPAGE_KV.get("github_json"),
                env.WEBPAGE_KV.get("raw_layout_html")
            ]);

            if (!cachedJSON) {
                const res = await env.GET_GITHUB_JSON.fetch("https://internal/?pull=json", {
                    headers: {"X-API-Key": env.GITHUB_WORKER_API_KEY || ""}
                });
                if (res.ok) cachedJSON = await res.text();
            }
            if (!rawLayoutHTML) {
                const res = await env.GET_GITHUB_JSON.fetch("https://internal/?pull=html", {
                    headers: {"X-API-Key": env.GITHUB_WORKER_API_KEY || ""}
                });
                if (res.ok) rawLayoutHTML = await res.text();
            }

            if (!cachedJSON || !rawLayoutHTML) {
                throw new Error("Critical source recovery components missing.");
            }

            const githubValue = JSON.parse(cachedJSON);
            const projectEntries = Object.entries(githubValue.Projects || {});
            const postEntries = Object.entries(githubValue.Posts || {});
            const descJSON = {};
            let count = 0;

            for (const [_, entry] of projectEntries) descJSON[count++] = entry.description || '';
            for (const [_, entry] of postEntries) descJSON[count++] = entry.description || '';

            const mdResponse = await env.MARKDOWN_TO_HTML.fetch("https://internal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(descJSON),
            });
            const htmlDescJson = await mdResponse.json();
            
            count = 0;
            for (const [_, entry] of projectEntries) entry.description = htmlDescJson[count++];
            for (const [_, entry] of postEntries) entry.description = htmlDescJson[count++];

            let finalHtml = rawLayoutHTML;
            
            const projectHTML = projectEntries.map(([title, entry], idx) => projectTemplate({
                entryGroup: "projects", entryIndex: idx, title, link: entry.link, imgSrc: entry.imgSrc, imgDes: entry.imgDes, tags: entry.tags, description: entry.description
            })).join('\n');

            const postHTML = postEntries.map(([title, entry], idx) => projectTemplate({
                entryGroup: "posts", entryIndex: idx, title, link: entry.link, imgSrc: entry.imgSrc, imgDes: entry.imgDes, tags: entry.tags, description: entry.description
            })).join('\n');

            finalHtml = finalHtml.replace("<!--placeholder-projects-data-->", projectHTML)
                                 .replace("<!--placeholder-posts-data-->", postHTML);

            ctx.waitUntil(
                Promise.all([
                    env.WEBPAGE_KV.put("html_render", finalHtml),
                    env.WEBPAGE_KV.put("html_render_fresh", "true")
                ])
            );

            return new Response(finalHtml, {
                headers: { "Content-Type": "text/html;charset=UTF-8" }
            });

        } catch (error) {
            console.error("Pipeline failure:", error.message);
            return env.ASSETS.fetch(request);
        }
    }
};