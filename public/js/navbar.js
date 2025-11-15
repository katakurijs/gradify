async function loadUsername() {
  try {
    const res = await fetch("/api/username");
    const data = await res.json();

    if (!data.username) {
      window.location.href = "/login";
      return;
    }

    const usernameEl = document.getElementById("username");
    if (usernameEl) {
      usernameEl.innerText = data.username;
    }

  } catch (err) {
    console.error("Failed to load username:", err);
    window.location.href = "/login";
  }
}

loadUsername();