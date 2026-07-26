const treeEl = document.getElementById("tree");
const resultsEl = document.getElementById("results");
const emptyStateEl = document.getElementById("emptyState");
const searchEl = document.getElementById("search");
const clearSearchBtn = document.getElementById("clearSearch");
const saveCurrentTabBtn = document.getElementById("saveCurrentTab");
const saveFolderPicker = document.getElementById("saveFolderPicker");
const folderSelect = document.getElementById("folderSelect");
const confirmSaveBtn = document.getElementById("confirmSave");
const cancelSaveBtn = document.getElementById("cancelSave");
const newRootFolderBtn = document.getElementById("newRootFolder");
const openManagerBtn = document.getElementById("openManager");

let rootNodes = [];
let expandedFolders = {};
let draggedId = null;

const FOLDER_ICON_SVG = `<svg viewBox="0 0 20 20" width="15" height="15"><path fill="#f2b544" d="M2 5a1 1 0 0 1 1-1h4.4a1 1 0 0 1 .8.4l1 1.3a1 1 0 0 0 .8.4H17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z"/></svg>`;
const CHEVRON_SVG = `<svg viewBox="0 0 20 20" width="10" height="10"><path fill="currentColor" d="M7 4l6 6-6 6V4z"/></svg>`;

function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", "32");
  return u.toString();
}

async function loadExpandedState() {
  const stored = await chrome.storage.local.get("expandedFolders");
  expandedFolders = stored.expandedFolders || {};
}

async function saveExpandedState() {
  await chrome.storage.local.set({ expandedFolders });
}

async function loadTree() {
  const tree = await chrome.bookmarks.getTree();
  rootNodes = tree[0].children || [];
  render();
}

function isFolder(node) {
  return !node.url;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  if (query) {
    renderSearchResults(query);
  } else {
    resultsEl.classList.add("hidden");
    emptyStateEl.classList.add("hidden");
    treeEl.classList.remove("hidden");
    treeEl.innerHTML = "";
    for (const node of rootNodes) {
      treeEl.appendChild(buildFolderRow(node, 0, true));
    }
  }
}

function buildFolderRow(node, depth, isTopLevel) {
  const wrapper = document.createElement("div");

  const row = document.createElement("div");
  row.className = "row folder-row";
  row.dataset.id = node.id;
  const isOpen = isTopLevel ? expandedFolders[node.id] === true : !!expandedFolders[node.id];
  if (isOpen) row.classList.add("expanded");

  const hasChildren = (node.children || []).some(() => true);

  row.innerHTML = `
    <span class="twisty ${hasChildren ? "" : "spacer"}">${CHEVRON_SVG}</span>
    <span class="icon">${FOLDER_ICON_SVG}</span>
    <span class="label"></span>
    <span class="actions">
      <button class="add-sub" title="New subfolder">+ folder</button>
      <button class="rename" title="Rename">✎</button>
      <button class="delete" title="Delete">🗑</button>
    </span>
  `;
  row.querySelector(".label").textContent = node.title || "(untitled)";

  row.draggable = !isTopLevel;
  row.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    draggedId = node.id;
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    row.classList.remove("drag-over");
    if (draggedId && draggedId !== node.id) {
      await chrome.bookmarks.move(draggedId, { parentId: node.id });
      draggedId = null;
      await loadTree();
    }
  });

  const childrenEl = document.createElement("div");
  childrenEl.className = "children" + (isOpen ? " open" : "");

  function renderChildren() {
    childrenEl.innerHTML = "";
    for (const child of node.children || []) {
      if (isFolder(child)) {
        childrenEl.appendChild(buildFolderRow(child, depth + 1, false));
      } else {
        childrenEl.appendChild(buildBookmarkRow(child));
      }
    }
  }
  renderChildren();

  row.querySelector(".twisty").addEventListener("click", async (e) => {
    e.stopPropagation();
    const nowOpen = !childrenEl.classList.contains("open");
    childrenEl.classList.toggle("open", nowOpen);
    row.classList.toggle("expanded", nowOpen);
    expandedFolders[node.id] = nowOpen;
    await saveExpandedState();
  });
  row.addEventListener("click", () => row.querySelector(".twisty").click());

  row.querySelector(".add-sub").addEventListener("click", (e) => {
    e.stopPropagation();
    startInlineCreate(node.id, childrenEl, () => {
      childrenEl.classList.add("open");
      row.classList.add("expanded");
      expandedFolders[node.id] = true;
      saveExpandedState();
    });
  });

  row.querySelector(".rename").addEventListener("click", (e) => {
    e.stopPropagation();
    startInlineRename(row, node.id, node.title);
  });

  row.querySelector(".delete").addEventListener("click", async (e) => {
    e.stopPropagation();
    const count = countDescendants(node);
    const msg = count > 0
      ? `Delete "${node.title}" and its ${count} item(s) inside?`
      : `Delete "${node.title}"?`;
    if (confirm(msg)) {
      await chrome.bookmarks.removeTree(node.id);
      await loadTree();
    }
  });

  wrapper.appendChild(row);
  wrapper.appendChild(childrenEl);
  return wrapper;
}

function countDescendants(node) {
  let count = 0;
  for (const child of node.children || []) {
    count += 1;
    if (child.children) count += countDescendants(child);
  }
  return count;
}

function buildBookmarkRow(node) {
  const row = document.createElement("div");
  row.className = "row bookmark-row";
  row.dataset.id = node.id;
  row.draggable = true;

  row.innerHTML = `
    <span class="twisty spacer">${CHEVRON_SVG}</span>
    <span class="icon"><img src="${faviconUrl(node.url)}" alt="" /></span>
    <span class="label"></span>
    <span class="actions">
      <button class="rename" title="Rename">✎</button>
      <button class="delete" title="Delete">🗑</button>
    </span>
  `;
  row.querySelector(".label").textContent = node.title || node.url;
  row.title = node.url;

  row.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    draggedId = node.id;
  });

  row.addEventListener("click", () => {
    chrome.tabs.create({ url: node.url });
  });

  row.querySelector(".rename").addEventListener("click", (e) => {
    e.stopPropagation();
    startInlineRename(row, node.id, node.title);
  });

  row.querySelector(".delete").addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.bookmarks.remove(node.id);
    await loadTree();
  });

  return row;
}

function startInlineCreate(parentId, childrenContainer, onCreated) {
  const line = document.createElement("div");
  line.className = "row";
  line.innerHTML = `<span class="twisty spacer"></span><span class="icon">${FOLDER_ICON_SVG}</span>`;
  const input = document.createElement("input");
  input.className = "inline-input";
  input.placeholder = "Folder name";
  line.appendChild(input);
  childrenContainer.prepend(line);
  childrenContainer.classList.add("open");
  input.focus();

  const finish = async (commit) => {
    if (commit && input.value.trim()) {
      await chrome.bookmarks.create({ parentId, title: input.value.trim() });
      onCreated();
      await loadTree();
    } else {
      line.remove();
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

function startInlineRename(row, id, currentTitle) {
  const label = row.querySelector(".label");
  const input = document.createElement("input");
  input.className = "inline-input";
  input.value = currentTitle;
  label.replaceWith(input);
  input.focus();
  input.select();

  const finish = async (commit) => {
    if (commit && input.value.trim() && input.value.trim() !== currentTitle) {
      await chrome.bookmarks.update(id, { title: input.value.trim() });
    }
    await loadTree();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("click", (e) => e.stopPropagation());
}

function flattenAll(nodes, path) {
  const out = [];
  for (const node of nodes) {
    const fullPath = path ? `${path} / ${node.title}` : node.title;
    if (isFolder(node)) {
      out.push({ node, path, isFolder: true });
      out.push(...flattenAll(node.children || [], fullPath));
    } else {
      out.push({ node, path, isFolder: false });
    }
  }
  return out;
}

function renderSearchResults(query) {
  treeEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");
  resultsEl.innerHTML = "";

  const flat = flattenAll(rootNodes, "");
  const matches = flat.filter(({ node }) => {
    const title = (node.title || "").toLowerCase();
    const url = (node.url || "").toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (matches.length === 0) {
    emptyStateEl.classList.remove("hidden");
    return;
  }
  emptyStateEl.classList.add("hidden");

  for (const { node, path, isFolder: folder } of matches) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <span class="twisty spacer"></span>
      <span class="icon">${folder ? FOLDER_ICON_SVG : `<img src="${faviconUrl(node.url)}" alt="" />`}</span>
      <span class="label"></span>
      <span class="path"></span>
    `;
    row.querySelector(".label").textContent = node.title || node.url;
    row.querySelector(".path").textContent = path || "Bookmarks";
    if (!folder) {
      row.title = node.url;
      row.addEventListener("click", () => chrome.tabs.create({ url: node.url }));
    } else {
      row.style.cursor = "default";
    }
    resultsEl.appendChild(row);
  }
}

searchEl.addEventListener("input", () => {
  clearSearchBtn.classList.toggle("hidden", !searchEl.value);
  render();
});
clearSearchBtn.addEventListener("click", () => {
  searchEl.value = "";
  clearSearchBtn.classList.add("hidden");
  searchEl.focus();
  render();
});

newRootFolderBtn.addEventListener("click", async () => {
  const barId = rootNodes[0] ? rootNodes[0].id : "1";
  const name = prompt("New folder name:");
  if (name && name.trim()) {
    await chrome.bookmarks.create({ parentId: barId, title: name.trim() });
    expandedFolders[barId] = true;
    await saveExpandedState();
    await loadTree();
  }
});

openManagerBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://bookmarks" });
});

saveCurrentTabBtn.addEventListener("click", async () => {
  saveFolderPicker.classList.toggle("hidden");
  if (!saveFolderPicker.classList.contains("hidden")) {
    populateFolderSelect();
  }
});

cancelSaveBtn.addEventListener("click", () => {
  saveFolderPicker.classList.add("hidden");
});

function populateFolderSelect() {
  folderSelect.innerHTML = "";
  const flat = flattenAll(rootNodes, "").filter((e) => e.isFolder);
  for (const { node, path } of flat) {
    const opt = document.createElement("option");
    opt.value = node.id;
    opt.textContent = path ? `${path} / ${node.title}` : node.title;
    folderSelect.appendChild(opt);
  }
}

confirmSaveBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const parentId = folderSelect.value;
  await chrome.bookmarks.create({ parentId, title: tab.title || tab.url, url: tab.url });
  expandedFolders[parentId] = true;
  await saveExpandedState();
  saveFolderPicker.classList.add("hidden");
  await loadTree();
});

(async function init() {
  await loadExpandedState();
  await loadTree();
})();
