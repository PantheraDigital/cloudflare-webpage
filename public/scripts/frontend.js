function addSortBars(allEntryTags){
    const tagSelectorTemplate = document.querySelector('#tag-selector-template');
    for (const tagGroup in allEntryTags){
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
        input.addEventListener("change", (event)=>{
                container.querySelectorAll("hr")?.forEach((element)=>{element.remove()});
                
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
        
        for (const tag of allEntryTags[tagGroup]){
            const labelClone = document.importNode(label, true);
            const input = labelClone.querySelector("input");

            labelClone.querySelector("span").textContent = tag;

            labelClone.setAttribute("for", tagGroup + tag);
            input.setAttribute("id", tagGroup + tag);
            input.setAttribute("name", tagGroup + "-sort");
            input.setAttribute("value", tag);
            input.removeAttribute("checked");

            input.addEventListener("change", (event)=>{
                container.querySelectorAll("hr")?.forEach((element)=>{element.remove()});

                let hrAdded = false;
                sortPageEntries(
                    container,
                    Array.from(container.querySelectorAll(".entry")),
                    (a,b)=>{return sortEntriesByTag(a,b,tag);},
                    (entry)=>{
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

function sortPageEntries(page, entries, sortFunc, highlightFunc){
    entries.sort(sortFunc);
    for (const entry of entries){
        if (highlightFunc) { highlightFunc(entry); }
        page.insertAdjacentElement("beforeend", entry);
    }
}
function sortEntriesByTag(a, b, tag){
    const aTags = a.getAttribute("data-tags");
    const bTags = b.getAttribute("data-tags");
    if (!aTags) { return 1; }
    if (!bTags) { return -1; }

    const aHasTag = aTags.includes(tag);
    const bHasTag = bTags.includes(tag);

    if ((aHasTag && bHasTag) || (!aHasTag && !bHasTag)){
        return sortEntriesByIndex(a,b);
    } else if (aHasTag && !bHasTag){
        return -1;
    } else if (!aHasTag && bHasTag) {
        return 1;
    } else {
        return 0;
    }
}
function sortEntriesByIndex(a,b){
    const aOIndex = parseInt(a.getAttribute("data-original-index"));
    const bOIndex = parseInt(b.getAttribute("data-original-index"));
    return aOIndex - bOIndex;
}


let slides = document.getElementById("slide-list").children;
let activeSlideIndex = 0;
let prevClickedNav = null;
function navigateToSlide(clickedElement, index) {
	if (index == activeSlideIndex || index > slides.length) {
		return;
	}

    clickedElement.classList.add("selected");
    if (prevClickedNav) {
        prevClickedNav.classList.remove("selected");
    }
    prevClickedNav = clickedElement;

	let active = slides[activeSlideIndex];
	let newActive = slides[index];

	if (index > activeSlideIndex) {
		active.classList.add("slide-left");
		if (Math.abs(index - activeSlideIndex) > 1) {
			for (let i = activeSlideIndex + 1; i < index; i++) {
				slides[i].classList.replace("slide-right", "slide-left");
			}
		}
	} else {
		active.classList.add("slide-right");
		if (Math.abs(index - activeSlideIndex) > 1) {
			for (let i = activeSlideIndex - 1; i > index; i--) {
				slides[i].classList.replace("slide-left", "slide-right");
			}
		}
	}

	newActive.classList.remove("slide-left");
	newActive.classList.remove("slide-right");
	activeSlideIndex = index;
}


function initPage() {
    // nav buttons
    document.querySelectorAll('.nav-button').forEach((element) => {
        if (element.getAttribute("href") === "#about") { 
            prevClickedNav = element;
            element.classList.add("selected"); 
        }
        element.setAttribute("href", "#main")
    });

    // background behaviour
    document.querySelector('#bg-layer').querySelector(".crt3").style.position = "absolute";

    // slide list
    for (let i = 0; i < slides.length; i++) {
        if (i != activeSlideIndex) {
            slides[i].classList.add("slide-right");
        }
        slides[i].classList.add("slide-element");
    }
    document.querySelector('#main').style.overflow = "hidden";

    // entry sorting
    let allEntryTags = {};
    const projects = document.querySelector('#projects-container').querySelectorAll(".project-details");
    const posts = document.querySelector('#posts-container').querySelectorAll(".post");

    let tagGroup = "projects";
    for (const entry of projects) {
        const entryTags = entry.getAttribute("data-tags").split(",").map((element) => element = element.trim());
        let newSet = (Object.hasOwn(allEntryTags, tagGroup)) ? [...allEntryTags[tagGroup], ...entryTags] : entryTags;
        allEntryTags[tagGroup] = new Set(newSet);

        // remove temp img bg
        const img = entry.querySelector("img");
        if (img) {
            img.addEventListener("load", (event) => { img.removeAttribute("style"); });
        }
    }

    tagGroup = "posts";
    for (const entry of posts) {
        const entryTags = entry.parentElement.getAttribute("data-tags").split(",").map((element) => element = element.trim());
        let newSet = (Object.hasOwn(allEntryTags, tagGroup)) ? [...allEntryTags[tagGroup], ...entryTags] : entryTags;
        allEntryTags[tagGroup] = new Set(newSet);
    
        // remove temp img bg
        const img = entry.querySelector("img");
        if (img) {
            img.addEventListener("load", (event) => { img.removeAttribute("style"); });
        }
    }

    addSortBars(allEntryTags);
}
initPage();
