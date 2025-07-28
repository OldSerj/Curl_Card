document.getElementById("curl-btn").addEventListener("click", async () => {
    const url = document.getElementById("url-input").value.trim();
    const previewDiv = document.getElementById("preview-card");

    if (!url) {
        previewDiv.innerHTML = "<p>Enter a valid URL, netrunner.</p>";
        previewDiv.classList.remove("hidden");
        return;
    }

    previewDiv.innerHTML = "<p>Fetching metadata... 🌀</p>";
    previewDiv.classList.remove("hidden");

    try {
        const response = await fetch(`/preview?url=${encodeURIComponent(url)}`);
        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            previewDiv.innerHTML = `<p>Error parsing metadata. The server did not return valid JSON.</p>`;
            previewDiv.classList.remove("hidden");
            return;
        }

        if (!data.title && !data.description && !data.image) {
            previewDiv.innerHTML = `<p>${data.description || "No useful metadata found. Site may be sus or too basic."}</p>`;
            previewDiv.classList.remove("hidden");
            return;
        }

        previewDiv.innerHTML = `
            ${data.image ? `<img src="${data.image}" alt="Preview Image" class="preview-img">` : ''}
            <h2>${data.title || "No title found"}</h2>
            <p>${data.description || "No description available"}</p>
            <span class="site-label">${data.site}</span>
        `;
        previewDiv.classList.remove("hidden");
    } catch (err) {
        previewDiv.innerHTML = `<p>Error fetching metadata. That link might be throwing elbows: ${err.message}</p>`;
        previewDiv.classList.remove("hidden");
    }
});

// 🌗 Simple dark mode toggle — this assumes dark mode CSS is done
document.getElementById("toggle-dark").addEventListener("click", () => {
    document.body.classList.toggle("dark");
});
