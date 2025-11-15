const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const errorMsg = document.getElementById("error-msg");

  if (error === "missing") {
    errorMsg.textContent = "Please fill in both fields.";
    errorMsg.style.display = "block";
  } else if (error === "invalid") {
    errorMsg.textContent = "Incorrect username or password.";
    errorMsg.style.display = "block";
  }