// A copy button on every listing.
//
// The demo drawer has had one since Chapter 11 was written; a static listing
// is the same problem and deserves the same affordance. Both paths are here
// because navigator.clipboard is unavailable on an insecure origin, which is
// how most people read a local build.

for (const pre of document.querySelectorAll("main pre")) {
  const wrap = document.createElement("div");
  wrap.className = "listing";
  pre.parentNode.insertBefore(wrap, pre);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "listing-copy";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy this listing");

  button.addEventListener("click", async () => {
    const text = pre.innerText;
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      ok = document.execCommand("copy");
      area.remove();
    }
    button.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { button.textContent = "Copy"; }, 1600);
  });

  wrap.append(button, pre);
}
