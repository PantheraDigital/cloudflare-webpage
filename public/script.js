function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

async function copyAnchorPath(element) {
    if (!element) return;
    let text = "";
    if (typeof element === "string") text = element;
    else if (element.id) text = element.id;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#${text}`);
    } catch (error) {
        console.error(error.message);
    }
}


function addSortBars(allEntryTags) {
    const tagSelectorTemplate = document.querySelector('#tag-selector-template');
    for (const tagGroup in allEntryTags) {
        const page = document.getElementById(tagGroup);
        const pageContent = (page) ? page.querySelector('section.main-content') : null;
        if (!pageContent) { continue; }

        const pageTitle = pageContent.querySelector("h2");
        const tagSelector = document.importNode(tagSelectorTemplate.content, true);
        const label = tagSelector.querySelector("label");
        const labelContainer = tagSelector.querySelector("span");
        const container = page.querySelector("#" + tagGroup.toLowerCase() + "-container");

        const input = label.querySelector("input");
        label.setAttribute("for", tagGroup + "None");
        input.setAttribute("id", tagGroup + "None");
        input.setAttribute("name", tagGroup + "-sort");
        input.setAttribute("value", "None");
        input.setAttribute("checked", "");
        input.addEventListener("change", (event) => {
            container.querySelectorAll("hr")?.forEach((element) => { element.remove() });

            sortPageEntries(
                container,
                Array.from(container.querySelectorAll(".entry")),
                sortEntriesByIndex,
                null
            );

            const titleSort = pageTitle.innerText.indexOf(" / ");
            if (titleSort !== -1) {
                pageTitle.innerText = pageTitle.innerText.substring(0, titleSort);
            }
        });

        for (const tag of allEntryTags[tagGroup]) {
            const labelClone = document.importNode(label, true);
            const input = labelClone.querySelector("input");

            labelClone.querySelector("span").textContent = tag;

            labelClone.setAttribute("for", tagGroup + tag);
            input.setAttribute("id", tagGroup + tag);
            input.setAttribute("name", tagGroup + "-sort");
            input.setAttribute("value", tag);
            input.removeAttribute("checked");

            input.addEventListener("change", (event) => {
                container.querySelectorAll("hr")?.forEach((element) => { element.remove() });

                let hrAdded = false;
                sortPageEntries(
                    container,
                    Array.from(container.querySelectorAll(".entry")),
                    (a, b) => { return sortEntriesByTag(a, b, tag); },
                    (entry) => {
                        const tags = entry.getAttribute("data-tags");
                        if (!tags.includes(tag) && !hrAdded) {
                            container.insertAdjacentElement("beforeend", document.createElement("hr"));
                            hrAdded = true;
                        }
                    }
                );

                const titleSort = pageTitle.innerText.indexOf(" / ");
                if (titleSort === -1) {
                    pageTitle.innerText += " / " + tag;
                } else {
                    pageTitle.innerText = pageTitle.innerText.substring(0, titleSort + 3) + tag;
                }
            });

            labelContainer.appendChild(labelClone);
            labelContainer.appendChild(document.createTextNode(" "));
        }

        pageContent.appendChild(tagSelector);
    }
}

function sortPageEntries(page, entries, sortFunc, highlightFunc) {
    entries.sort(sortFunc);
    for (const entry of entries) {
        if (highlightFunc) { highlightFunc(entry); }
        page.insertAdjacentElement("beforeend", entry);
    }
}
function sortEntriesByTag(a, b, tag) {
    const aTags = a.getAttribute("data-tags");
    const bTags = b.getAttribute("data-tags");
    if (!aTags) { return 1; }
    if (!bTags) { return -1; }

    const aHasTag = aTags.includes(tag);
    const bHasTag = bTags.includes(tag);

    if ((aHasTag && bHasTag) || (!aHasTag && !bHasTag)) {
        return sortEntriesByIndex(a, b);
    } else if (aHasTag && !bHasTag) {
        return -1;
    } else if (!aHasTag && bHasTag) {
        return 1;
    } else {
        return 0;
    }
}
function sortEntriesByIndex(a, b) {
    const aOIndex = parseInt(a.getAttribute("data-original-index"));
    const bOIndex = parseInt(b.getAttribute("data-original-index"));
    return aOIndex - bOIndex;
}


function initPage() {
    // pre set light/dark
    document.getElementById("display-mode-toggle").checked = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // entry sorting
    let allEntryTags = {};
    const projects = document.querySelector('#projects-container').querySelectorAll(".project-details");
    const articles = document.querySelector('#articles-container').querySelectorAll(".article-details");

    let tagGroup = "projects";
    for (const entry of projects) {
        const entryTags = entry.getAttribute("data-tags").split(",").map((element) => element = element.trim());
        let newSet = (Object.hasOwn(allEntryTags, tagGroup)) ? [...allEntryTags[tagGroup], ...entryTags] : entryTags;
        allEntryTags[tagGroup] = new Set(newSet);

        const imgs = entry.querySelectorAll("img");
        for (const img of imgs) {
            img.addEventListener("load", (event) => img.classList.add("loaded"));
            img.classList.add("expand-img");
            img.loading = 'lazy';
        }
    }

    tagGroup = "articles";
    for (const entry of articles) {
        const entryTags = entry.parentElement.getAttribute("data-tags").split(",").map((element) => element = element.trim());
        let newSet = (Object.hasOwn(allEntryTags, tagGroup)) ? [...allEntryTags[tagGroup], ...entryTags] : entryTags;
        allEntryTags[tagGroup] = new Set(newSet);

        const imgs = entry.querySelectorAll("img");
        for (const img of imgs) {
            img.addEventListener("load", (event) => img.classList.add("loaded"));
            img.classList.add("expand-img");
            img.loading = 'lazy';
        }
    }

    addSortBars(allEntryTags);

    // full screen imgs
    const imgOverlay = document.getElementById("full-img-overlay");
    const imgOverlayImg = document.getElementById("full-img-overlay-img");

    document.querySelectorAll('.expand-img').forEach((element) => {
        element.addEventListener("click", (event) => {
            const srcData = element.getAttribute("data-high-res-src");
            imgOverlayImg.src = srcData || element.src;
            imgOverlayImg.alt = element.alt;
            imgOverlay.classList.remove("remove");

            if (!element.classList.contains("expand-img")) {
                element.classList.add("expand-img");
            }
        });
    });
    imgOverlay.addEventListener("click", (event) => imgOverlay.classList.add("remove"));
    imgOverlayImg.addEventListener("click", (event) => event.stopPropagation());

    // paralax
    const hasHover = window.matchMedia('(hover: hover)').matches;
    const paraList = Array.from(document.querySelectorAll(".para"));
    const paraXList = Array.from(document.querySelectorAll(".para-x"));
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    const updateParaLayers = (paraArray, ParaXArray, mouseX, mouseY) => {
        paraArray.forEach((layer) => {
            const speed = layer.getAttribute("data-speed");
            layer.style.translate = `${mouseX / speed}px ${mouseY / speed}px`;
        });
        ParaXArray.forEach((layer) => {
            const speed = layer.getAttribute("data-speed");
            layer.style.translate = `${mouseX / speed}px`;
        });
    };

    if (hasHover) {
        const windowLayer = document.getElementById("window-layer");

        document.addEventListener("mousemove", (e) => {
            mouseX = (e.clientX - window.innerWidth / 2);
            mouseY = (e.clientY - window.innerHeight / 2);

            if (!windowLayer.classList.contains("remove")) {
                return;
            }
            updateParaLayers(paraList, paraXList, mouseX, mouseY);
        });
    }

    // display windows
    const appLayer = document.getElementById("app-layer");
    document.querySelectorAll(".close-display-window").forEach((element) => {
        element.addEventListener("click", (event) => {
            const displayWindow = event.currentTarget.closest(".display-window");
            displayWindow.classList.add("remove");
            displayWindow.parentElement.classList.add("remove");
            appLayer.querySelectorAll("a, button, input").forEach((element) => {
                element.removeAttribute("tabindex");
            });

            if (hasHover) updateParaLayers(paraList, paraXList, mouseX, mouseY);
        });
    });

    document.querySelectorAll(".main-grid .app-icon").forEach((element) => {
        element.addEventListener("click", (event) => {
            const windowID = event.currentTarget.hash?.slice(1);
            if (!windowID) return;
            const displayWindow = document.getElementById(windowID);
            if (!displayWindow) return;

            event.preventDefault();
            displayWindow.classList.remove("remove");
            displayWindow.parentElement.classList.remove("remove");
            appLayer.querySelectorAll("a, button, input").forEach((element) => {
                element.setAttribute("tabindex", "-1");
            });
        });
    });

    // game display
    const webpageDisplay = document.getElementById("webpage-display");

    const gameDisplay = document.getElementById("game-display");
    const closeGameDisplayBtn = document.getElementById("close-game-display");
    const gameContainer = document.getElementById("game-container");

    closeGameDisplayBtn.addEventListener("click", (event) => {
        gameDisplay.classList.add("remove");
        webpageDisplay.classList.remove("remove");
        while(gameContainer.firstChild) gameContainer.firstChild.remove();
    });
}
initPage();