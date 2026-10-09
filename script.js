// =====================================
// LabourDeck - Main JavaScript
// =====================================

const $ = (id) => document.getElementById(id);

const STORAGE = {
    workers: "labourdeck_workers",
    jobs: "labourdeck_jobs",
    requests: "labourdeck_requests",
    activeWorker: "labourdeck_active_worker"
};

// Read saved data safely
function readData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getActiveWorkerId() {
    return localStorage.getItem(STORAGE.activeWorker);
}

// Escape user-entered text before displaying it in HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// =====================================
// 1. PAGE NAVIGATION
// =====================================

function openPage(pageId) {
    $("homePage").style.display = "none";
    $("workerPage").style.display = "none";
    $("employerPage").style.display = "none";
    $("requestPage").style.display = "none";

    $(pageId).style.display =
        pageId === "homePage" ? "block" : "block";

    if (pageId === "workerPage") {
        updateWorkerDashboard();
    }

    if (pageId === "requestPage") {
        showRequests();
    }

    window.scrollTo(0, 0);
}

$("openWorker").addEventListener("click", () => {
    openPage("workerPage");
});

$("openEmployer").addEventListener("click", () => {
    openPage("employerPage");
});

document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
        openPage(button.dataset.back);
    });
});

// =====================================
// 2. WORKER REGISTRATION
// =====================================

$("workerForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const phone = $("workerPhone").value.trim();

    if (!/^[0-9]{10}$/.test(phone)) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }

    const workers = readData(STORAGE.workers);

    // Update an existing profile if the same phone is registered
    let worker = workers.find(item => item.phone === phone);

    const workerData = {
        id: worker ? worker.id : (
            Date.now().toString() + Math.random().toString(16).slice(2)
        ),
        name: $("workerName").value.trim(),
        phone: phone,
        skill: $("workerSkill").value,
        location: $("workerLocation").value.trim(),
        count: Number($("workerCount").value),
        available: $("workerAvailability").value
    };

    if (!workerData.name || !workerData.location ||
        workerData.count < 1) {
        alert("Please complete all fields correctly.");
        return;
    }

    if (worker) {
        Object.assign(worker, workerData);
    } else {
        workers.push(workerData);
    }

    saveData(STORAGE.workers, workers);

    // Keep this profile active for the prototype demo
    localStorage.setItem(STORAGE.activeWorker, workerData.id);

    alert("Worker profile saved successfully! ✅");

    $("workerForm").reset();
    updateWorkerDashboard();
});

// =====================================
// 3. WORKER DASHBOARD
// =====================================

function updateWorkerDashboard() {
    const activeId = getActiveWorkerId();
    const workers = readData(STORAGE.workers);

    const worker = workers.find(item => item.id === activeId);

    if (!worker) {
        $("workerStatus").textContent = "Not registered";
        $("workerRequestCount").textContent = "0 requests";
        return;
    }

    $("workerStatus").textContent =
        worker.available === "Yes"
            ? "🟢 Available"
            : "🔴 Unavailable";

    const requests = readData(STORAGE.requests).filter(
        request => request.workerId === worker.id
    );

    $("workerRequestCount").textContent =
        `${requests.length} request${requests.length === 1 ? "" : "s"}`;
}

$("viewRequests").addEventListener("click", () => {
    if (!getActiveWorkerId()) {
        alert("Please register as a worker first.");
        return;
    }

    openPage("requestPage");
});

// =====================================
// 4. EMPLOYER POSTS A JOB
// =====================================

// Prevent selecting past dates
const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

$("jobDate").min = localToday;

$("employerForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const job = {
        id: Date.now().toString(),
        type: $("jobType").value,
        workersRequired: Number($("workersRequired").value),
        location: $("jobLocation").value.trim(),
        date: $("jobDate").value,
        time: $("jobTime").value,
        urgency: $("urgency").value,
        wage: Number($("wage").value)
    };

    if (job.workersRequired < 1 || job.wage < 1) {
        alert("Please enter a valid number of workers and wage.");
        return;
    }

    if (job.date < localToday) {
        alert("Please choose today or a future date.");
        return;
    }

    const jobs = readData(STORAGE.jobs);
    jobs.push(job);
    saveData(STORAGE.jobs, jobs);

    localStorage.setItem("labourdeck_current_job", job.id);

    findMatchingWorkers(job);
});

// =====================================
// 5. SMART MATCHING
// =====================================

function findMatchingWorkers(job) {
    const workers = readData(STORAGE.workers);

    const matches = workers
        .filter(worker => worker.available === "Yes")
        .map(worker => {
            let score = 0;

            // Skill: 40 points
            if (
                worker.skill.toLowerCase() ===
                job.type.toLowerCase()
            ) {
                score += 40;
            }

            // Location: 30 points for exact match,
            // 20 points for a partial text match
            const workerLocation = worker.location
                .toLowerCase().trim();

            const jobLocation = job.location
                .toLowerCase().trim();

            if (workerLocation === jobLocation) {
                score += 30;
            } else if (
                workerLocation.includes(jobLocation) ||
                jobLocation.includes(workerLocation)
            ) {
                score += 20;
            }

            // Availability: 20 points
            score += 20;

            // Group size: 10 points
            if (worker.count >= job.workersRequired) {
                score += 10;
            }

            return {
                ...worker,
                score: score
            };
        })
        .filter(worker => worker.score >= 50)
        .sort((a, b) => b.score - a.score);

    showMatchingWorkers(matches, job);
}

// =====================================
// 6. DISPLAY MATCHING WORKERS
// =====================================

function showMatchingWorkers(workers, job) {
    const results = $("results");

    results.innerHTML = `
        <h3>🎯 Smart Matches</h3>
        <p class="subtitle">
            ${workers.length} suitable worker group(s) found.
        </p>

        ${job.urgency === "Urgent" ? `
            <div class="urgent-banner">
                🚨 URGENT REQUIREMENT — NEED TODAY
            </div>
        ` : ""}

        <div class="result-box">
            <h3>📋 Job Summary</h3>
            <p><strong>Work:</strong> ${escapeHTML(job.type)}</p>
            <p><strong>Workers needed:</strong> ${job.workersRequired}</p>
            <p><strong>Location:</strong> ${escapeHTML(job.location)}</p>
            <p><strong>Date:</strong> ${escapeHTML(job.date)}</p>
            <p><strong>Wage per worker:</strong> ₹${job.wage}</p>
            <p><strong>Estimated total:</strong> ₹${
                (job.workersRequired * job.wage).toLocaleString("en-IN")
            }</p>
            <p><small>Total is an estimate, not a completed payment.</small></p>
        </div>
    `;

    if (workers.length === 0) {
        results.innerHTML += `
            <div class="empty-message">
                😕 No suitable available workers found.
                Try another skill or location.
            </div>
        `;
        return;
    }

    workers.forEach(worker => {
        let badge = "👍 Suitable Match";

        if (worker.score >= 90) {
            badge = "🏆 Best Match";
        } else if (worker.score >= 70) {
            badge = "⭐ Good Match";
        }

        const card = document.createElement("div");
        card.className = "result-box";

        card.innerHTML = `
            <h3>👷 ${escapeHTML(worker.name)}</h3>

            <div class="match-score">
                ${badge} — ${worker.score}% Match
            </div>

            <p><strong>Skill:</strong> ${escapeHTML(worker.skill)}</p>
            <p><strong>Location:</strong> ${escapeHTML(worker.location)}</p>
            <p><strong>Group size:</strong> ${worker.count} worker(s)</p>
            <p><strong>Availability:</strong> 🟢 Available</p>
            <p><strong>Wage per worker:</strong> ₹${job.wage}</p>

            <button type="button" class="send-request-btn">
                📩 Send Request
            </button>
        `;

        card.querySelector(".send-request-btn").addEventListener(
            "click",
            () => sendRequest(worker.id, job.id)
        );

        results.appendChild(card);
    });
}

// =====================================
// 7. SEND WORK REQUEST
// =====================================

function sendRequest(workerId, jobId) {
    const workers = readData(STORAGE.workers);
    const jobs = readData(STORAGE.jobs);
    const requests = readData(STORAGE.requests);

    const worker = workers.find(item => item.id === workerId);
    const job = jobs.find(item => item.id === jobId);

    if (!worker || !job) {
        alert("Worker or job not found. Please try again.");
        return;
    }

    const alreadySent = requests.some(request =>
        request.workerId === workerId &&
        request.jobId === jobId
    );

    if (alreadySent) {
        alert("A request has already been sent to this worker.");
        return;
    }

    requests.push({
        id: Date.now().toString() +
            Math.random().toString(16).slice(2),
        workerId: worker.id,
        workerName: worker.name,
        jobId: job.id,
        jobType: job.type,
        location: job.location,
        workersRequired: job.workersRequired,
        date: job.date,
        time: job.time,
        urgency: job.urgency,
        wage: job.wage,
        totalPayment: job.wage * job.workersRequired,
        status: "Pending",
        paymentStatus: "Pending"
    });

    saveData(STORAGE.requests, requests);

    alert("Work request sent successfully! ✅");
    updateWorkerDashboard();
}

// =====================================
// 8. SHOW WORKER REQUESTS
// =====================================

function showRequests() {
    const activeId = getActiveWorkerId();

    const requests = readData(STORAGE.requests).filter(
        request => request.workerId === activeId
    );

    const container = $("requestDetails");

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                No work requests yet. Requests sent to your
                registered profile will appear here.
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    requests.forEach(request => {
        const card = document.createElement("div");
        card.className = "result-box";

        card.innerHTML = `
            <h3>🔔 ${escapeHTML(request.jobType)} Work</h3>

            ${request.urgency === "Urgent" ? `
                <div class="urgent-banner">🚨 URGENT JOB</div>
            ` : ""}

            <p><strong>Location:</strong> ${escapeHTML(request.location)}</p>
            <p><strong>Workers required:</strong> ${request.workersRequired}</p>
            <p><strong>Date:</strong> ${escapeHTML(request.date)}</p>
            <p><strong>Time:</strong> ${escapeHTML(request.time)}</p>
            <p><strong>Wage per worker:</strong> ₹${request.wage}</p>

            <p><strong>Request status:</strong></p>
            <span class="status-pill request-status">
                ${escapeHTML(request.status)}
            </span>

            <p><strong>Payment status:</strong></p>
            <span class="status-pill payment-status">
                ${escapeHTML(request.paymentStatus)}
            </span>

            <div class="request-actions"></div>
        `;

        const actions = card.querySelector(".request-actions");

        if (request.status === "Pending") {
            const acceptButton = document.createElement("button");
            acceptButton.className = "accept-btn";
            acceptButton.textContent = "✅ Accept";
            acceptButton.addEventListener("click", () => {
                updateRequestStatus(request.id, "Accepted");
            });

            const rejectButton = document.createElement("button");
            rejectButton.className = "reject-btn";
            rejectButton.textContent = "❌ Reject";
            rejectButton.addEventListener("click", () => {
                updateRequestStatus(request.id, "Rejected");
            });

            actions.append(acceptButton, rejectButton);
        }

        if (
            request.status === "Accepted" &&
            request.paymentStatus !== "Paid"
        ) {
            const paidButton = document.createElement("button");
            paidButton.textContent = "💰 Mark Payment Received";
            paidButton.addEventListener("click", () => {
                markPaymentReceived(request.id);
            });

            actions.appendChild(paidButton);
        }

        container.appendChild(card);
    });
}

// =====================================
// 9. ACCEPT OR REJECT A REQUEST
// =====================================

function updateRequestStatus(requestId, newStatus) {
    const requests = readData(STORAGE.requests);
    const request = requests.find(item => item.id === requestId);

    if (!request) {
        alert("Request not found.");
        return;
    }

    request.status = newStatus;
    saveData(STORAGE.requests, requests);

    alert(
        newStatus === "Accepted"
            ? "Work request accepted! ✅"
            : "Work request rejected."
    );

    showRequests();
    updateWorkerDashboard();
}

// =====================================
// 10. PAYMENT STATUS TRACKING
// =====================================

function markPaymentReceived(requestId) {
    const requests = readData(STORAGE.requests);
    const request = requests.find(item => item.id === requestId);

    if (!request || request.status !== "Accepted") {
        alert("Only accepted requests can be updated.");
        return;
    }

    const confirmed = confirm(
        "Have you actually received the payment? " +
        "This only updates the prototype's status."
    );

    if (!confirmed) {
        return;
    }

    request.paymentStatus = "Paid";
    saveData(STORAGE.requests, requests);

    alert("Payment status updated to Paid. ✅");

    showRequests();
}

// =====================================
// 11. INITIAL SETUP
// =====================================

updateWorkerDashboard();

