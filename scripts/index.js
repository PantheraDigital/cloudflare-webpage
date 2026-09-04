/* env vars
    HTML_KV - full page and entry snippets
    POST_PREFIX - post entry key prefix
    PROJECT_PREFIX - project entry key prefix
    INTERNAL_API_KEY - key to locked services
*/
import { WorkerEntrypoint } from "cloudflare:workers";
import projectTemplate from "../templates/project-template.html";
import postTemplate from "../templates/post-template.html";

class KVContentHandler {
    constructor(env, keys, type, template, prefix) {
        this.env = env;
        this.keys = keys;
        this.type = type;
        this.template = template;
        this.prefix = prefix;
    }

    extractH1Title(htmlString, fallbackTitle) {
        const lowerHtml = htmlString.toLowerCase();
        const startTagIdx = lowerHtml.indexOf("<h1");
        if (startTagIdx === -1) return fallbackTitle;

        const openTagEndIdx = htmlString.indexOf(">", startTagIdx);
        if (openTagEndIdx === -1) return fallbackTitle;

        const closeTagIdx = lowerHtml.indexOf("</h1>", openTagEndIdx);
        if (closeTagIdx === -1) return fallbackTitle;

        const rawTitle = htmlString.slice(openTagEndIdx + 1, closeTagIdx);
        return rawTitle.trim() || fallbackTitle;
    }

    async element(el) {
        try {
            //console.log(`Rendering ${this.type} | Keys:`, JSON.stringify(this.keys.map(k => k.name)));
            // KV get() - max keys 100, response size limit 25MB
            const batches = createBatches(this.keys);
            const templateData = [];

            for (const batch of batches) {
                const batchKeyNames = batch.map(k => k.name);
                const entries = await this.env.HTML_KV.get(batchKeyNames);

                for (const key of batch) {
                    const rawBody = entries.get(key.name) || "";

                    const defaultTitle = key.name.slice(this.prefix.length);
                    const title = this.extractH1Title(rawBody, defaultTitle);
                    const fullBody = title === defaultTitle ? rawBody :
                        rawBody.slice(rawBody.indexOf("</h1>") + 6);

                    const tagHTML = key.metadata.tags?.map((tag) => `<span>${tag}</span>`) ?? "";

                    if (this.type === "post") {
                        // posts
                        //  entryIndex, title, short, body, tags
                        const splitIndex = fullBody.indexOf('<hr class="page-br">');
                        const preBody = splitIndex !== -1 ? fullBody.slice(0, splitIndex) : "";
                        const mainBody = splitIndex !== -1 ? fullBody.slice(splitIndex + 20) : fullBody;

                        templateData.push({
                            entryIndex: key.metadata.indexOverride || null,
                            title: title,
                            short: preBody,
                            body: mainBody,
                            rawTags: key.metadata.tags || "",
                            displayTags: tagHTML.join(" "),
                        });
                    } else if (this.type === "project") {
                        // projects
                        //  entryIndex, title, body, tags
                        templateData.push({
                            entryIndex: key.metadata.indexOverride || null,
                            title: title,
                            body: fullBody,
                            rawTags: key.metadata.tags || "",
                            displayTags: tagHTML.join(" "),
                        });
                    }
                }
            }

            templateData.sort((a, b) => {
                if (a.entryIndex === null && b.entryIndex === null) {
                    return 0;
                } else if (a.entryIndex !== null && b.entryIndex === null) {
                    return -1;
                } else if (a.entryIndex === null && b.entryIndex !== null) {
                    return 1;
                } else {
                    return a.entryIndex - b.entryIndex;
                }
            });

            templateData.forEach((data, index) => {
                if (!data.entryIndex) { data.entryIndex = index; }
                el.append(renderHTMLTemplate(this.template, data) + "\n", { html: true });
            });

        } catch (error) {
            console.error("KVContentHandler error: ", error);
            el.append("<!-- Error loading content -->", { html: true });
        }
    }
}

// ai
function renderHTMLTemplate(template, data) {
    // Helper to safely resolve a single variable or literal value
    function resolveValue(token) {
        token = token.trim();
        if (!token) return '';

        // Handle string literals
        const firstChar = token[0];
        if ((firstChar === "'" || firstChar === '"') && token.endsWith(firstChar)) {
            return token.slice(1, -1);
        }

        // Handle booleans/null
        if (token === 'true') return true;
        if (token === 'false') return false;
        if (token === 'null' || token === 'undefined') return '';

        // Handle numeric literals
        if (!isNaN(Number(token))) return Number(token);

        // Handle object key lookups
        return data.hasOwnProperty(token) ? data[token] : '';
    }

    // Safe expression evaluator
    function safeEval(expr) {
        expr = expr.trim();

        // Check if expression is a ternary: condition ? trueVal : falseVal
        const ternaryMatch = expr.match(/^(.+?)\?(.*):(.*)$/);

        if (ternaryMatch) {
            const conditionExpr = ternaryMatch[1].trim();
            const trueExpr = ternaryMatch[2].trim();
            const falseExpr = ternaryMatch[3].trim();

            const conditionValue = resolveValue(conditionExpr);
            const isTruthy = Array.isArray(conditionValue) ? conditionValue.length > 0 : Boolean(conditionValue);

            const chosenExpr = isTruthy ? trueExpr : falseExpr;

            // Check if chosen branch contains nested template literals (`...`)
            if (chosenExpr.startsWith('`') && chosenExpr.endsWith('`')) {
                const innerContent = chosenExpr.slice(1, -1);
                return renderHTMLTemplate(innerContent, data);
            }

            return resolveValue(chosenExpr);
        }

        // Standard variable lookup (e.g., "tags.join(', ')")
        if (expr.includes('.join(')) {
            const [arrName, glue] = expr.split('.join(');
            const cleanGlue = glue.replace(/['"`)]/g, '');
            const arr = data[arrName.trim()];
            return Array.isArray(arr) ? arr.join(cleanGlue) : '';
        }

        return resolveValue(expr);
    }

    let result = '';
    let lastIndex = 0;

    // Jump chunk-by-chunk instead of character-by-character
    let startIdx = template.indexOf('${', lastIndex);

    while (startIdx !== -1) {
        // Append the static HTML chunk before the placeholder
        result += template.slice(lastIndex, startIdx);

        let braceDepth = 1;
        let inString = null;
        let j = startIdx + 2;

        // Fast-forward to find the matching closing brace
        while (j < template.length && braceDepth > 0) {
            const char = template[j];
            const prevChar = template[j - 1];

            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (inString === null) inString = char;
                else if (inString === char) inString = null;
            } else if (!inString) {
                if (char === '{') braceDepth++;
                else if (char === '}') braceDepth--;
            }
            j++;
        }

        if (braceDepth === 0) {
            const expression = template.slice(startIdx + 2, j - 1);
            result += safeEval(expression);
            lastIndex = j;
        } else {
            // Failsafe: if brackets are malformed, output the literal '${' and move on
            result += '${';
            lastIndex = startIdx + 2;
        }

        startIdx = template.indexOf('${', lastIndex);
    }

    // Append any remaining static HTML after the last placeholder
    result += template.slice(lastIndex);

    // Strip empty lines using Regex instead of Array split/filter/join
    return result.replace(/^\s*$(?:\r\n?|\n)/gm, '');
}


// strings in V8 are UTF-16, not UTF-8

// return final form of page html as string
async function renderPage(env) {
    // list return [{keys:[{ name:"", expiration:num, metadata:{} }], list_complete:bool, cursor:""}]
    const [htmlRes, postKVList, projectKVList] = await Promise.all([
        env.ASSETS.fetch(new Request(new URL("/index.html", "http://dummy"))),
        env.HTML_KV.list({ prefix: env.POST_PREFIX, limit: 1000 }),
        env.HTML_KV.list({ prefix: env.PROJECT_PREFIX, limit: 1000 })
    ]);
    if (!htmlRes.ok) {
        throw new Error(`Failed to load base HTML: ${htmlRes.status} ${htmlRes.statusText}`);
    }

    const postKeys = postKVList.keys.filter((entry) => entry.metadata?.live === true);
    const projectKeys = projectKVList.keys.filter((entry) => entry.metadata?.live === true);

    if (postKeys.length === 0) { console.warn("Post Keys empty"); }
    if (projectKeys.length === 0) { console.warn("Project Keys empty"); }

    const rewriter = new HTMLRewriter()
        .on('div#posts-container', new KVContentHandler(env, postKeys, "post", postTemplate, env.POST_PREFIX))
        .on('div#projects-container', new KVContentHandler(env, projectKeys, "project", projectTemplate, env.PROJECT_PREFIX));

    return rewriter.transform(htmlRes);
}

function createBatches(kvKeyList) {
    // KV get() - max keys 100, response size limit 25MB
    // 1B * 1024 * 1024 = 1MiB
    // 1B * 1000 * 1000 = 1MB
    const resultBatch = [];
    const maxBatchSize = (25 * 1000 * 1000) - 1000; // 25MB - 1kb

    let currentBatch = []; // [[{ name:"", expiration:num, metadata:{} }, ...], ...]
    let currentBatchSize = 0; // key.metadata.size = char count. 1 char = 1 byte

    for (const key of kvKeyList) {
        const size = parseInt(key.metadata.size || 0);
        if (size > maxBatchSize) {
            continue;
        }

        if (currentBatchSize + size > maxBatchSize
            || currentBatch.length === 100) {
            resultBatch.push(currentBatch);
            currentBatch = [];
            currentBatchSize = 0;
        }

        currentBatchSize += size;
        currentBatch.push(key);
    }
    if (currentBatch.length > 0) {
        resultBatch.push(currentBatch);
    }
    return resultBatch;
}

function keysMatch(userKey, secretKey) {
    const encoder = new TextEncoder();
    const encodedUK = encoder.encode(userKey);
    const encodedSK = encoder.encode(secretKey);
    const lengthsMatch = encodedUK.byteLength === encodedSK.byteLength;
    return lengthsMatch 
			? crypto.subtle.timingSafeEqual(encodedUK, encodedSK)
			: !crypto.subtle.timingSafeEqual(encodedUK, encodedUK);
}


// GET - public get asset
// POST - internal use only, render html and store
export default class extends WorkerEntrypoint {
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "POST") {
            if (url.pathname !== "/admin/force-render") {
                return new Response("Not Found", { status: 404 });
            }

            const clientApiKey = request.headers.get("X-API-Key");
            if (!this.env.INTERNAL_API_KEY || !keysMatch(clientApiKey, this.env.INTERNAL_API_KEY)) {
                return new Response("Unauthorized: Invalid or Missing API Key", { status: 401 });
            }
            
            try {
                await this.render();
                return new Response("Render success", { status: 200 });
            } catch (error) {
                console.error("Render failure:", error.message);
                return new Response(`Render failure: ${error.message}`, { status: 500 });
            }

        } else if (request.method === "GET") {
            if (url.pathname === "/admin") {
                const REQUIRED_PASSWORD = this.env.INTERNAL_API_KEY;
                const authHeader = request.headers.get("Authorization");
                
                if (!this.env.INTERNAL_API_KEY) {
                    return new Response("Server Configuration Error", { status: 500 });
                }
                if (!authHeader || !authHeader.startsWith("Basic ")) {
                    return new Response("Unauthorized - Username and Password Required", {
                        status: 401,
                        headers: {
                            "WWW-Authenticate": 'Basic realm="Admin Webpages"',
                        },
                    });
                }
                
                try {
                    const encoded = authHeader.substring(6);
                    const decoded = atob(encoded);

                    const colonIndex = decoded.indexOf(":");
                    if (colonIndex === -1) {
                        return new Response("Unauthorized - Invalid Auth Format", {
                            status: 401,
                            headers: { "WWW-Authenticate": 'Basic realm="Admin Webpages"' },
                        });
                    }

                    const username = decoded.substring(0, colonIndex).trim();
                    const password = decoded.substring(colonIndex + 1);

                    if (!username || !keysMatch(password, REQUIRED_PASSWORD)) {
                        return new Response("Unauthorized - Username or Password Invalid", {
                            status: 401,
                            headers: { "WWW-Authenticate": 'Basic realm="Admin Webpages"' },
                        });
                    }

                    console.log(`[ACTION] ${username} - ${request.method} ${url.pathname}`);
                    return this.env.ASSETS.fetch(request);

                } catch (error) {
                    console.error(error.message);
                    return new Response("Internal Server Error", { status: 500 });
                }
                
            }

            if (url.pathname !== "/" && url.pathname !== "/index.html") {
                return this.env.ASSETS.fetch(request);
            }

            try {
                const renderedHTML = await this.env.HTML_KV.get("html_render");
                if (renderedHTML) {
                    return new Response(renderedHTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
                }
            } catch (error) {
                console.error("HTML gathering failure", error.message);
                return new Response("Internal Server Error", { status: 500 });
            }
        }
        return new Response("Not Found", { status: 404 });
    }

    async render() {
        try {
            const newHTML = await renderPage(this.env);
            await this.env.HTML_KV.put("html_render", newHTML.body)
                .catch(err => console.error("Failed to save render to KV:", err));

            console.log("Render success");
        } catch (error) {
            console.error("Render failure:", error.message);
            throw new Error(`Render failure: ${error.message}`, { cause: error });
        }
    }
};