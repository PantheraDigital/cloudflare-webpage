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


let activeSlideData = { index: undefined, id: undefined, slide: undefined, selector: null };
const slides = [];
function initSlides(initialSlideId) {
    document.querySelectorAll("#slide-list>.slide-element").forEach((slide, index) => {
        if (!slide.id) return;

        const selector = document.querySelector(`.nav-button[href='#${slide.id}']`);
        const data = { index: index, id: slide.id, slide: slide, selector: selector };

        slides.push(data);

        if ((initialSlideId && initialSlideId === slide.id) || (!initialSlideId && !activeSlideData.id)) {
            activeSlideData = data;
            if (data.selector) data.selector.classList.add("selected");
        } else {
            if (activeSlideData.index !== undefined && index > activeSlideData.index) {
                slide.classList.add("slide-right");
            } else if (activeSlideData.index === undefined) {
                slide.classList.add("slide-left");
            }
        }
    });
}

function navToSlide(arg) {
    if (!arg) return;
    let slideID;
    
    if (arg instanceof Event) {
        const href = arg.currentTarget.href;
        const hashIndex = href.lastIndexOf("#");
        if (hashIndex === -1) return;
        slideID = href.slice(hashIndex + 1);
    } else if (typeof arg === "string") {
        slideID = arg;
    } else {
        return;
    }

    const scrollToSlide = () => {
        if (arg instanceof Event) {
            arg.preventDefault();
        }
        if (!isElementInViewport(activeSlideData.slide)) {
            activeSlideData.slide.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    if (slideID === activeSlideData.id) {
        scrollToSlide();
        return;
    };

    const slideIndex = slides.findIndex((element) => element.slide.id === slideID);
    const slide = slides[slideIndex].slide;

    // move old slide
    if (slideIndex > activeSlideData.index) {
        activeSlideData.slide.classList.add("slide-left");
        if (Math.abs(slideIndex - activeSlideData.index) > 1) {
            for (let i = activeSlideData.index + 1; i < slideIndex; i++) {
                slides[i].slide.classList.replace("slide-right", "slide-left");
            }
        }
    } else {
        activeSlideData.slide.classList.add("slide-right");
        if (Math.abs(slideIndex - activeSlideData.index) > 1) {
            for (let i = activeSlideData.index - 1; i > slideIndex; i--) {
                slides[i].slide.classList.replace("slide-left", "slide-right");
            }
        }
    }

    if (activeSlideData.selector) activeSlideData.selector.classList.remove("selected");
    if (slides[slideIndex].selector) slides[slideIndex].selector.classList.add("selected");

    slide.classList.remove("slide-left", "slide-right");
    activeSlideData = slides[slideIndex];
    scrollToSlide();
}

function initPage() {
    // pre set light/dark
    document.getElementById("display-mode-toggle").checked = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // page nav buttons
    document.getElementById("page-nav")?.querySelectorAll("a.nav-button")?.forEach((element) => {
        element.addEventListener("click", navToSlide);
    });
    
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
            imgOverlay.classList.remove("hide");

            if (!element.classList.contains("expand-img")) {
                element.classList.add("expand-img");
            }
        });
    });
    imgOverlay.addEventListener("click", (event) => imgOverlay.classList.add("hide"));
    imgOverlayImg.addEventListener("click", (event) => event.stopPropagation());


    const initialHash = window.location.hash.slice(1);
    const targetElement = initialHash ? document.getElementById(initialHash) : null;
    const targetSlide = targetElement ? targetElement.closest(".slide-element") : null;
    const initialSlideId = targetSlide ? targetSlide.id : null;
    initSlides(initialSlideId);

    // nav to element if url is manually typed
    window.addEventListener("hashchange", () => {
        const initialHash = window.location.hash.slice(1);
        const targetElement = initialHash ? document.getElementById(initialHash) : null;
        const targetSlide = targetElement ? targetElement.closest(".slide-element") : null;
        const initialSlideId = targetSlide ? targetSlide.id : null;
        if (initialSlideId) {
            navToSlide(initialSlideId);
            if (targetElement !== targetSlide) {
                targetElement.scrollIntoView();
            }
        }
    });

    // about title change
    const aboutEl = document.getElementById("about");
    const aboutTitleSubtitle = aboutEl.querySelector("h3");
    const aboutNavEl = aboutEl.querySelector(".about-nav");

    let activeSubpageID = "";

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const topicText = entry.target.getAttribute("data-topic");
                aboutTitleSubtitle.innerText = topicText;
                activeSubpageID = entry.target.id;

                aboutNavEl.querySelector(".selected")?.classList.remove("selected");
                aboutNavEl.querySelector(`[href='#${activeSubpageID}']`)?.classList.add("selected");
            }
        });
    }, {threshold: 0.5});

    aboutEl.querySelectorAll("[name='about-subpage']").forEach((element, index) => {
        if (index === 0)  aboutTitleSubtitle.innerText = element.getAttribute("data-topic");
        observer.observe(element);
    });

    // about link copy
    const aboutPageTitle = aboutEl.querySelector(".page-title");
    const aboutAnchorButton = aboutPageTitle.querySelector("button");
    aboutAnchorButton.addEventListener("click", () => {
        copyAnchorPath(activeSubpageID);
    });
}
initPage();