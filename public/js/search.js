async function loadResults() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  if (!query) return;

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  const resultsBody = document.getElementById("resultsBody");
  const resultsTable = document.getElementById("resultsTable");
  const forDiv = document.getElementById("for");

  forDiv.innerHTML = `Search results for: <span style="color: #007bff;">${query}</span>`;

  resultsBody.innerHTML = "";

  if (!data.length) {
    resultsTable.style.display = "none";
    resultsBody.innerHTML = "<tr><td colspan='3'>No matches found.</td></tr>";
    return;
  }

  // Show table
  resultsTable.style.display = "table";

  data.forEach(item => {
    // Capitalize name
    const formattedName = item.name
      .toLowerCase()
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.filiere}</td>
      <td>${item.apogee}</td>
      <td><a href="/display/${item.apogee}">${formattedName}</a></td>
    `;

    resultsBody.appendChild(tr);
  });
}

loadResults();
