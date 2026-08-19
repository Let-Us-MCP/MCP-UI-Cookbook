// Search across the whole book, from a static site with no backend.
//
// The index is `search-index.json`, one entry per section, built from the
// rendered pages so that generated content is searchable too. It is fetched on
// the first interaction rather than on load: 162 kB is cheap for somebody who
// searches and pure waste for somebody who does not.
//
// This started as a combobox and should not have been one, which Chapter 23
// says in as many words. A combobox listbox holds options, and an option may
// not contain a link, so the pattern forces the results to stop being links:
// no middle click, no open in a new tab, no copy link address. axe reported it
// as three violations including one critical, which was the pattern arguing
// back.
//
// What it is instead: a labelled search field, a plain list of ordinary links,
// a polite live region carrying the count, and arrow keys that move focus
// through the results. Every result is a real link, every behaviour a link has
// still works, and there is no ARIA to get wrong.

(() => {
  const MAX_RESULTS = 30;
  const SNIPPET = 165;

  const box = document.getElementById("book-search");
  if (!box) return;

  const input = box.querySelector("input");
  const list = document.getElementById("search-results");
  const status = document.getElementById("search-status");

  let index = null;
  let loading = null;
  let results = [];

  const base = new URL(".", document.baseURI).href;

  function load() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    status.textContent = "Loading the index…";
    loading = fetch(new URL("search-index.json", base))
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => { index = data.sections; status.textContent = ""; return index; })
      .catch((error) => {
        // A search box that fails silently is worse than no search box.
        status.textContent = `The search index did not load (${error.message}). `
          + "Reload the page, or use your browser's find on a single chapter.";
        loading = null;
        throw error;
      });
    return loading;
  }

  const norm = (s) => s.toLowerCase();

  function score(entry, terms, phrase) {
    const hay = norm(entry.x);
    const head = norm(entry.h + " " + entry.t);
    let total = 0;
    for (const term of terms) {
      const inHead = head.includes(term);
      let hits = 0;
      let at = hay.indexOf(term);
      while (at !== -1 && hits < 40) { hits += 1; at = hay.indexOf(term, at + term.length); }
      if (!hits && !inHead) return 0;          // every term must appear somewhere
      total += hits + (inHead ? 25 : 0);
    }
    // An exact phrase is almost always what the reader meant.
    if (phrase.length > 2) {
      if (head.includes(phrase)) total += 200;
      else if (hay.includes(phrase)) total += 60;
    }
    return total;
  }

  function snippet(text, terms, phrase) {
    const hay = norm(text);
    let at = phrase.length > 2 ? hay.indexOf(phrase) : -1;
    if (at === -1) {
      for (const term of terms) {
        at = hay.indexOf(term);
        if (at !== -1) break;
      }
    }
    if (at === -1) at = 0;
    let start = Math.max(0, at - Math.floor(SNIPPET / 3));
    if (start > 0) {
      const space = text.indexOf(" ", start);
      if (space !== -1 && space - start < 20) start = space + 1;
    }
    const cut = text.slice(start, start + SNIPPET);
    return (start > 0 ? "…" : "") + cut + (start + SNIPPET < text.length ? "…" : "");
  }

  const escape = (s) => s.replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function mark(text, terms) {
    let out = escape(text);
    // Longest first, so "display mode" is not chopped up by "mode".
    for (const term of [...terms].sort((a, b) => b.length - a.length)) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(${safe})(?![^<]*>)`, "gi"), "<mark>$1</mark>");
    }
    return out;
  }

  function render() {
    list.replaceChildren();
    if (!results.length) {
      list.hidden = true;
      return;
    }
    const terms = currentTerms();
    results.forEach((entry, i) => {
      const item = document.createElement("li");
      item.className = "search-hit";

      const link = document.createElement("a");
      link.href = entry.a ? `${entry.p}#${entry.a}` : entry.p;
      link.dataset.hit = String(i);

      const where = document.createElement("span");
      where.className = "search-where";
      where.innerHTML = `${escape(entry.t)}${entry.h
        ? ` <span class="search-sep">›</span> ${mark(entry.h, terms)}` : ""}`;

      const text = document.createElement("span");
      text.className = "search-snippet";
      text.innerHTML = mark(snippet(entry.x, terms, currentPhrase()), terms);

      link.append(where, text);
      item.append(link);
      list.append(item);
    });
    list.hidden = false;
  }

  let terms = [];
  let phrase = "";
  const currentTerms = () => terms;
  const currentPhrase = () => phrase;

  function search(query) {
    phrase = norm(query.trim());
    terms = phrase.split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) {
      results = [];
      status.textContent = "";
      render();
      return;
    }
    load().then(() => {
      const scored = [];
      for (const entry of index) {
        const s = score(entry, terms, phrase);
        if (s > 0) scored.push([s, entry]);
      }
      scored.sort((a, b) => b[0] - a[0]);
      results = scored.slice(0, MAX_RESULTS).map((pair) => pair[1]);
      render();
      status.textContent = results.length
        ? `${scored.length} result${scored.length === 1 ? "" : "s"}`
          + (scored.length > MAX_RESULTS ? `, showing the first ${MAX_RESULTS}` : "")
        : `No results for ${query.trim()}`;
    }).catch(() => {});
  }

  // Focus moves for real, so a screen reader reads each result as the link it
  // is and Tab continues from wherever the reader stopped.
  const links = () => [...list.querySelectorAll("a")];

  function move(delta) {
    const all = links();
    if (!all.length) return;
    const at = all.indexOf(document.activeElement);
    if (at === -1) {
      (delta > 0 ? all[0] : all[all.length - 1]).focus();
      return;
    }
    const next = at + delta;
    if (next < 0) { input.focus(); return; }
    if (next >= all.length) return;
    all[next].focus();
    all[next].scrollIntoView({ block: "nearest" });
  }

  function close(returnFocus) {
    results = [];
    render();
    if (returnFocus) input.focus();
  }

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const value = input.value;
    debounce = setTimeout(() => search(value), 110);
  });

  input.addEventListener("focus", () => { load().catch(() => {}); });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Home" && results.length) {
      event.preventDefault(); active = -1; move(1);
    } else if (event.key === "End" && results.length) {
      event.preventDefault(); active = results.length - 1; move(0);
    } else if (event.key === "Enter") {
      const first = links()[0];
      if (first) { event.preventDefault(); first.click(); }
    } else if (event.key === "Escape") {
      if (results.length) { event.preventDefault(); close(false); }
      else input.value = "";
    }
  });

  // Arrows keep working once focus is inside the results, and Escape comes
  // back to the field rather than dumping the reader at the top of the page.
  list.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Escape") { event.preventDefault(); close(true); }
  });

  document.addEventListener("focusout", () => {
    // Give the incoming focus a tick to land before deciding it left.
    setTimeout(() => {
      if (!box.contains(document.activeElement)) close(false);
    }, 0);
  });

  document.addEventListener("click", (event) => {
    if (!box.contains(event.target)) close(false);
  });

  // "/" is the convention every documentation site has taught people, and
  // Cmd+K is the one every application has. Neither fires while the caret is
  // already in a field, because stealing a keystroke from typing is worse than
  // not having a shortcut.
  addEventListener("keydown", (event) => {
    const typing = /^(input|textarea|select)$/i.test(event.target.tagName)
      || event.target.isContentEditable;
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      input.focus();
      input.select();
    }
    if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
})();
