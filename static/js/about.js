document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".about-section");

    // LOG-OUT TRIGGER
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            const modal = new bootstrap.Modal(
                document.getElementById("logoutConfirmModal")
            );
            modal.show();
        });
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetId = item.getAttribute("data-target");
            const current = document.querySelector(".about-section.active");
            const next = document.getElementById(targetId);

            if (current === next) return;

            // Slide out current to left
            current.classList.add("exit-left");
            current.classList.remove("active");

            // Wait for transition end before removing exit class
            current.addEventListener("transitionend", () => {
                current.classList.remove("exit-left");
            }, { once: true });

            // Slide in next container
            next.classList.add("active");

            // Update nav active state
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
        });
    });

});
