document.addEventListener("DOMContentLoaded", function() {
  // Smooth page fade-in animation
  requestAnimationFrame(() => document.body.classList.add("fade-in"));

  // Smooth fade-out transition for internal links
  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = link.href;
        }, 500); // matches CSS transition duration
      });
    }
  });

  function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.style.backgroundColor = type === "error" ? "#f28b82" : "#4CAF50";
    toast.className = "show";
    setTimeout(() => {
      toast.className = toast.className.replace("show", "");
    }, 3000);
  }

  const form = document.getElementById("signupForm");
  const roleSelect = document.getElementById("role");
  const maintenanceDiv = document.getElementById("maintenanceTypeDiv");
  const maintenanceSelect = document.getElementById("maintenanceType");
  const passwordInput = document.getElementById("password");

  if (roleSelect && maintenanceDiv && maintenanceSelect) {
    const toggleMaintenance = () => {
      const isMaintenance = roleSelect.value === "maintenance";
      maintenanceDiv.style.display = isMaintenance ? "block" : "none";
      maintenanceSelect.disabled = !isMaintenance;
      if (!isMaintenance) maintenanceSelect.value = "";
    };

    toggleMaintenance();
    roleSelect.addEventListener("change", toggleMaintenance);
  }

  if (form) {
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])[A-Za-z\d]{8,}$/;
    // REGEX just like in JAVA: at least 1 uppercase, 1 lowercase, only letters/numbers, 8+ chars

    form.addEventListener("submit", function(e) {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = passwordInput.value.trim();

      if (!username || !email || !password) {
        showToast("All fields are required!", "error");
        return;
      }

      if (!passwordPattern.test(password)) {
        showToast("Password must have at least 1 uppercase, 1 lowercase, and 8 characters (no special symbols).", "error");
        return;
      }

      const confirmPassword = document.getElementById("confirm_password").value.trim();
      if (password !== confirmPassword) {
        showToast("Passwords do not match!", "error");
        return;
      }

      form.querySelector("button[type='submit']").disabled = true;
      form.submit();


    });
  }
});
