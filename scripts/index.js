import entryTemplate from "templates/entry-template.html";

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

// ai
function renderHTMLTemplate(template, data) {
  const regex = /\$\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  const keys = Object.keys(data);
  const values = Object.values(data);

  return template.replace(regex, (match, expression) => {
    try {
      const evaluator = new Function(...keys, `return ${expression.trim()};`);
      const result = evaluator(...values);
      return result !== undefined && result !== null ? result : '';
    } catch (e) {
      console.warn(`Failed to evaluate expression: "${expression}"`, e);
      return '';
    }
  });
}

async function renderHTML(request, env, overrideData = null, dataType = "") {
    // json == override or KV or get from github
    // html == override or ASSET or get from github
    let json = (overrideData && dataType === "json") ? overrideData : await env.WEBPAGE_KV.get("json");
    let html = (overrideData && dataType === "html") ? overrideData : null;
    
    if (!html) {
        const assetsResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
        if (assetsResponse.ok) {
            html = await assetsResponse.text();
        } else {
            html = await env.GET_GITHUB_JSON.fetchGitHubRawData("html");
            console.log("Get HTML fallback data");
        }
    }
    if (!json) { 
        json = await env.GET_GITHUB_JSON.fetchGitHubRawData("json");
        console.log("Get JSON fallback data");
    }
    
    if (!json || !html) {
        throw new Error("Critical source recovery components missing.");
    }

    const parsedJSON = JSON.parse(json);
    const projectEntries = Object.entries(parsedJSON.Projects || {});
    const postEntries = Object.entries(parsedJSON.Posts || {});
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
    const projectHTML = projectEntries.map(([title, entry], idx) => {
        const htmlDesc = htmlDescJson[count++];
        return projectTemplate({
            entryGroup: "projects", entryIndex: idx, title, link: entry.link, imgSrc: entry.imgSrc, imgDes: entry.imgDes, tags: entry.tags, description: htmlDesc
        });
    }).join('\n');

    const postHTML = postEntries.map(([title, entry], idx) => {
        const htmlDesc = htmlDescJson[count++];
        return projectTemplate({
            entryGroup: "posts", entryIndex: idx, title, link: entry.link, imgSrc: entry.imgSrc, imgDes: entry.imgDes, tags: entry.tags, description: htmlDesc
        });
    }).join('\n');

    return html.replace("<!--placeholder-projects-data-->", projectHTML)
                .replace("<!--placeholder-posts-data-->", postHTML);
}

// GET - public get asset
// POST - internal use only, render html and store
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "POST") {
            if (url.hostname !== "internal" || url.pathname !== "/render") {
                return new Response("Not Found", { status: 404 });
            }
            const clientApiKey = request.headers.get("X-API-Key");
            if (!env.INTERNAL_API_KEY || clientApiKey !== env.INTERNAL_API_KEY) {
                return new Response("Unauthorized: Invalid or Missing API Key", { status: 401 });
            }

            try {
                let contentType = request.headers.get('content-type');
                let overrideData = null;

                if (contentType) {
                    if (contentType.includes('application/json')) {
                        contentType = "json";
                        overrideData = await request.text();
                    } else if (contentType.includes('text/html')) {
                        contentType = "html";
                        overrideData = await request.text();
                    }
                }

                const newHTML = await renderHTML(request, env, overrideData, contentType);
                ctx.waitUntil(env.WEBPAGE_KV.put("html_render", newHTML));
                return new Response("Render Success");
                
            } catch (error) {
                console.error("Render failure:", error.message);
                return new Response(`Render failure: ${error.message}`);
            }
            
        } else if (request.method === "GET") {
            if (url.pathname === "test") {
                try {
                    const json = await env.WEBPAGE_KV.get("json");
                    let result = "";

                    for (const key in json) {
                        result += renderHTMLTemplate(entryTemplate, json[key]) + "\n\n";
                    }

                    return new Response(result);
                } catch (error) {
                    return new Response(`Test failure: ${error.message}`);
                }
            }

            if (url.pathname !== "/" && url.pathname !== "/index.html") {
                return env.ASSETS.fetch(request);
            }

            try {
                const renderedHTML = await env.WEBPAGE_KV.get("html_render");
                if (renderedHTML) {
                    return new Response(renderedHTML, {headers: { "Content-Type": "text/html;charset=UTF-8" }});
                }
            } catch (error) {
                console.error("HTML gathering failure", error.message);
            }
        }
        return new Response("Not Found", { status: 404 });
    }
};
