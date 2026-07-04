let globalTags = {};


// parse JSON to DOM elements
// {"entry 1 title": {}, "entry 2 title": {}}
function JSONToDOM(json, domElement, tagGroup){
    const projectTemplate = document.querySelector('#project-template');
    const entries = domElement.querySelectorAll(".project-details");
    let elementIndex = entries.length;
    
    for (const key in json){
        const clone = document.importNode(projectTemplate.content, true);

        clone.querySelector('summary').textContent = " " + key;

        if (Object.hasOwn(json[key], "imgSrc")){
            const img = clone.querySelector('img');
            img.src = json[key].imgSrc;
            img.alt = json[key].imgDescription;
        } else {
            clone.querySelector('img').remove();
            clone.querySelector('br').remove();
        }

        if (Object.hasOwn(json[key], "tags")){
            json[key].tags = json[key].tags.filter(Boolean);
            let newSet = (Object.hasOwn(globalTags, tagGroup)) ? [...globalTags[tagGroup], ...json[key].tags] : json[key].tags;
            globalTags[tagGroup] = new Set(newSet);
            clone.querySelector('[name="tags"]').insertAdjacentText("beforeend", json[key].tags.join(", "));
            clone.querySelector('details').setAttribute("data-tags", json[key].tags.toString());
        } else {
            clone.querySelector('[name="tags"]').remove();
        }
        
        if (Object.hasOwn(json[key], "description")){
            const tagElement = clone.querySelector('[name="tags"]');
            const detailsElement = clone.querySelector('details').querySelector('.project-body');
            
            for (const index in json[key].description) {
                const descElement = json[key].description[index];
                if (tagElement){
                    detailsElement.insertBefore(descElement, tagElement);
                } else {
                    detailsElement.appendChild(descElement);
                }
            }
        }

        if (Object.hasOwn(json[key], "link")){
            const link = clone.querySelector('a');
            link.href = json[key].link;
            link.textContent = json[key].link;
        } else {
            clone.querySelector('a').remove();
        }

        clone.querySelector('details').setAttribute("data-original-index", elementIndex);
        clone.querySelector('details').setAttribute("name", tagGroup + "-details");
        domElement.appendChild(clone);
        elementIndex += 1;
    }
}

// returns a single p element with inline elements [img, a, br]
function MDToHTML(mdText){
    const result = document.createElement("p");
    let start = 0;

    while (start < mdText.length - 1){
        let index1 = mdText.indexOf("[", start);
        let index2 = (index1 > -1 && index1 < mdText.length - 1) ? mdText.indexOf("]", index1 + 1) : -1;
        let indexi = (index2 > -1 && index2 < mdText.length - 1) ? mdText.indexOf("(", index2 + 1) : -1;
        let indexii = (indexi > -1 && indexi < mdText.length - 1) ? mdText.indexOf(")", indexi + 1) : -1;
        
        if (index2 === -1){ // no MD
            result.insertAdjacentText("beforeend", mdText.substring(start));
            break;
        }

        let elementText = mdText.substring(index1 + 1, index2);
        let elementSText = (indexi > -1 && indexi === index2 + 1 && indexii > -1) ? mdText.substring(indexi + 1, indexii) : "";

        if (index1 > start){ // leading text
            if (mdText[index1 - 1] === "!"){
                if (index1 - 1 > start){
                    result.insertAdjacentText("beforeend", mdText.substring(start, index1 - 1));
                }
            } else {
                result.insertAdjacentText("beforeend", mdText.substring(start, index1));
            }
        }
        
        if (elementSText){
            if (index1 > start && mdText[index1 - 1] === "!"){
                let img = document.createElement("img");
                img.src = elementSText;
                img.alt = elementText;
                result.appendChild(img);
            } else {
                let link = document.createElement("a");
                link.href = elementSText;
                link.textContent = (elementText === "") ? elementSText : elementText;
                result.appendChild(link);
            }
            start = indexii + 1;
        }else{
            if (elementText === "br"){
                let br = document.createElement("br");
                result.appendChild(br);
            } else { // not md element
                result.insertAdjacentText("beforeend", mdText.substring(start, index2 + 1));
            }
            start = index2 + 1;
        }
    }

    return result;
}

function addSortBars(){
    const tagSelectorTemplate = document.querySelector('#tag-selector-template');
    for (const tagGroup in globalTags){
        const page = document.getElementById(tagGroup);
        const pageContent = (page) ? page.querySelector('section.main-content') : null;
        if (!pageContent) { continue; }

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
        input.addEventListener("change", ()=>{
                sortPageEntries(container, sortEntriesByIndex);
            });
        
        for (const tag of globalTags[tagGroup]){
            const labelClone = document.importNode(label, true);
            const input = labelClone.querySelector("input");

            labelClone.querySelector("span").textContent = tag + " ";

            labelClone.setAttribute("for", tagGroup + tag);
            input.setAttribute("id", tagGroup + tag);
            input.setAttribute("name", tagGroup + "-sort");
            input.setAttribute("value", tag);
            input.removeAttribute("checked");

            input.addEventListener("change", ()=>{
                sortPageEntries(container, (a,b)=>{return sortEntriesByTag(a,b,tag);});
            });

            labelContainer.appendChild(labelClone);
        }

        pageContent.appendChild(tagSelector);
    }
}

function sortPageEntries(page, sortFunc){
    const entries = Array.from(page.querySelectorAll(".project-details"));
    entries.sort(sortFunc);
    for (const entry of entries){
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


async function initPage() {
    const pageJSON = window.githubData; // data from backend
    console.log(pageJSON);
    if (!pageJSON) { 
        console.log("Page Load Failed. Data: ", pageJSON);
        return; 
    }

    // parse entry descriptions from MD to HTML
    for (const categoryKey in pageJSON){ // key == Projects, Posts
        const category = categoryKey.toLowerCase();
        console.log(category.toUpperCase());

        for (const entryKey in pageJSON[categoryKey]){
            const entry = pageJSON[categoryKey][entryKey];
            console.log(entryKey);

            if (Object.hasOwn(entry, "description")){ // desc string to html array
                const desc = entry.description.trim().split("\n");
                let newDesc = [];

                for (const line of desc){
                    newDesc.push( (line !== "") ? MDToHTML(line) : document.createElement("br") );
                }
                entry.description = newDesc;
                console.log(entry.description);
            }
            entry.dataSource = "GitHub";
        }
    }
    console.log(pageJSON);

    JSONToDOM(pageJSON.projects, document.querySelector('#projects-container'), "projects");
    JSONToDOM(pageJSON.posts, document.querySelector('#posts-container'), "posts");
    addSortBars();
    document.getElementById("project-loading").remove();
    document.getElementById("post-loading").remove();
}
initPage();


/*
  auto scrolling text
*/
function enableScroll(scrollContainer, step = -0.1, updateFrequency = 0){
	let scrollContent = scrollContainer.querySelector(".auto-scroll-content");
	
	function scroll(){
		if(step < 0){
			scrollContent.style.left = (parseFloat(window.getComputedStyle(scrollContent).left) + step).toString() + "px";
			if(scrollContent.firstElementChild.getBoundingClientRect().right < scrollContainer.getBoundingClientRect().left){
				scrollContent.appendChild(scrollContent.firstElementChild);
				scrollContent.style.left = "";// resets pos to start
			}
		}else{
			scrollContent.style.right = (parseFloat(window.getComputedStyle(scrollContent).right) - step).toString() + "px";
			if(scrollContent.lastElementChild.getBoundingClientRect().left > scrollContainer.getBoundingClientRect().right){
				scrollContent.prepend(scrollContent.lastElementChild);
				scrollContent.style.right = (scrollContent.offsetWidth - scrollContainer.offsetWidth).toString() + "px";
			}
		}
	}

	if(scrollContent && scrollContainer){
		let stepOverride = scrollContainer.getAttribute("data-scroll-step");
		if(stepOverride){ step = parseFloat(stepOverride); }
		let updateOverride = scrollContainer.getAttribute("data-scroll-update");
		if(updateOverride){ updateFrequency = parseFloat(updateOverride); }

		if(step > 0){
			scrollContent.style.right = (scrollContent.offsetWidth - scrollContainer.offsetWidth).toString() + "px";
		}
		setInterval(scroll, updateFrequency);
	}
}

let scrolls = document.querySelectorAll(".auto-scroll-container");
for(const scroll of scrolls){
	enableScroll(scroll);
}



/*
  slide list
*/
let slides = document.getElementById("slide-list").children;
let activeSlideIndex = 0;

for (let i = 0; i < slides.length; i++) {
	if (i != activeSlideIndex) {
		slides[i].classList.add("slide-right");
	}
}

function navigateToSlide(index) {
	if (index == activeSlideIndex || index > slides.length) {
		return;
	}

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
