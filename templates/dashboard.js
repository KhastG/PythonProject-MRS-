document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard loaded!");

    // Example: confirmation before deleting a ticket
    const deleteForms = document.querySelectorAll(".delete-btn");
    deleteForms.forEach(button => {
        button.addEventListener("click", (event) => {
            if (!confirm("Are you sure you want to cancel this request?")) {
                event.preventDefault();
            }
        });
    });
});
