async function loadApogeeData() {
  const displayDiv = document.getElementById('display');
  const apogeeId = window.location.pathname.split("/").pop();

  // Show loading spinner
  displayDiv.innerHTML = `
    <div class="d-flex justify-content-center align-items-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <span class="ms-2">Fetching grades...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/display/${apogeeId}`);

    if (!res.ok) {
      displayDiv.innerHTML = '<p class="text-danger">Failed to load grades.</p>';
      return;
    }

    const tableHtml = await res.text();
    displayDiv.innerHTML = tableHtml;

  } catch (err) {
    console.error(err);
    displayDiv.innerHTML = '<p class="text-danger">Error loading grades.</p>';
  }
}

loadApogeeData();
