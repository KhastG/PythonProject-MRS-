document.addEventListener("DOMContentLoaded", function() {
  requestAnimationFrame(() => document.body.classList.add("fade-in"));

  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");
        setTimeout(() => { window.location.href = link.href; }, 500);
      });
    }
  });

  const form = document.getElementById("signupForm");
  if (form) {
    form.addEventListener("submit", function(e) {
      const username = document.getElementById("username")?.value.trim();
      const email = document.getElementById("email")?.value.trim();
      const password = document.getElementById("password")?.value.trim();

      if (!username || !email || !password) {
        e.preventDefault();
        alert("All fields are required!");
        return;
      }
    });
  }

  const roleSelect = document.getElementById("role");
  const maintenanceDiv = document.getElementById("maintenanceTypeDiv");
  const maintenanceSelect = document.getElementById("maintenanceType");

  if (roleSelect && maintenanceDiv && maintenanceSelect) {
    if (roleSelect.value === "maintenance") {
      maintenanceDiv.style.display = "block";
      maintenanceSelect.disabled = false;
    } else {
      maintenanceDiv.style.display = "none";
      maintenanceSelect.disabled = true;
    }

    roleSelect.addEventListener("change", () => {
      if (roleSelect.value === "maintenance") {
        maintenanceDiv.style.display = "block";
        maintenanceSelect.disabled = false;
      } else {
        maintenanceDiv.style.display = "none";
        maintenanceSelect.disabled = true;
        maintenanceSelect.value = "";
      }
    });
  }
});
