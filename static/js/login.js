document.addEventListener("DOMContentLoaded", function () {
   const errorValue = document.getElementById("loginError")?.value;
   const modal = document.getElementById("errorModal");
   const errorMessage = document.getElementById("errorMessage");
   const closeBtn = document.getElementById("closeModalBtn");

    if (errorValue && errorValue.trim() !== "") {
        errorMessage.textContent = errorValue;

        // SHOW MODAL POP-UP
        modal.classList.add("show");

        // SHAKE ANIMATION
        modal.classList.add("shake");

        // Remove shake class after animation ends (to allow re-triggering)
        setTimeout(() => {
            modal.classList.remove("shake");
        }, 500);

        // Auto-close after 3 seconds
        setTimeout(() => {
            modal.classList.remove("show");
        }, 3000);
    }

    // Manual close button
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.remove("show");
        });
    }

  requestAnimationFrame(() => {
    document.body.classList.add("fade-in");
  });

  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = link.href;
        }, 500); // to match sa CSS DURATION (login.css)
      });
    }
  });
});
