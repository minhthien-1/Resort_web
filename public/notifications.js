        import { apiGet, apiPut } from "./api.js";
        const notifFullList = document.getElementById("notifFullList");
        async function loadFull() {
        const data = await apiGet("/api/notifications");
        notifFullList.innerHTML = "";
        data.items.forEach((n) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${n.title}</strong><p>${n.message}</p>`;
        notifFullList.appendChild(li);
        });
        }
        loadFull();