
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const siteHeader = document.querySelector(".site-header");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const logoutButton = document.getElementById("logoutButton");
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const currentUserName = document.getElementById("currentUserName");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const accountAvatar = document.getElementById("accountAvatar");
const transactionsList = document.getElementById("transactionsList");

let allTransactions = [];
let editingExpenseId = null;
let editingIncomeId = null;
let incomeExpenseChart = null;

const today = new Date();
let selectedYear = today.getFullYear();
let selectedMonth = today.getMonth() + 1;

// =========================================
// HELPERS
// =========================================

function formatTransactionDate(value) {
    if (!value) return "No date";

    const str = String(value);
    const match = str.match(/^\d{4}-\d{2}-\d{2}/);

    return match ? match[0] : str;
}

function formatDateForInput(value) {
    return formatTransactionDate(value);
}

function formatMoney(value) {
    return `¥${Number(value).toLocaleString("ja-JP")}`;
}

function updateMonthTitle() {
    const date = new Date(selectedYear, selectedMonth - 1, 1);

    document.getElementById("monthTitle").textContent =
        date.toLocaleString("en-US", {
            month: "long",
            year: "numeric"
        });
}

function getCurrentMonthName() {
    return new Date(
        selectedYear,
        selectedMonth - 1,
        1
    ).toLocaleString("en-US", {
        month: "long",
        year: "numeric"
    });
}

function displayUser(user) {
    currentUserName.textContent = user.name;
    accountName.textContent = user.name;
    accountEmail.textContent = user.email;
    accountAvatar.textContent =
        user.name.charAt(0).toUpperCase();
}

function showNotification(message) {
    const element = document.getElementById("notification");
    if (!element) return;

    element.textContent = message;
    element.style.display = "block";

    setTimeout(() => {
        element.style.display = "none";
    }, 4000);
}

async function getJSON(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

// =========================================
// PAGE NAVIGATION
// =========================================

const navigationButtons = document.querySelectorAll(
    ".nav-item, .mobile-nav-item"
);

const pages = {
    dashboard: document.getElementById("dashboardPage"),
    manage: document.getElementById("managePage"),
    transactions: document.getElementById("transactionsPage"),
    profile: document.getElementById("profilePage"),
    settings: document.getElementById("settingsPage")
};

function showPage(pageName) {
    const selectedPage = pages[pageName];
    if (!selectedPage) return;

    Object.values(pages).forEach(page => {
        if (page) page.hidden = true;
    });

    selectedPage.hidden = false;

    navigationButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    if (pageName === "dashboard") {
        loadAvailableBalance();
    }

    if (pageName === "manage") {
        refreshManage();
    }

    if (pageName === "transactions") {
        loadTransactions();
    }
    if (pageName === "profile") {
    loadProfile();
    loadPreferences();
    }

    if (pageName === "settings") {
    loadProfile();
    loadPreferences();
    }
}

navigationButtons.forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

document.querySelectorAll("[data-go-page]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.goPage);
    });
});

// =========================================
// AUTHENTICATION
// =========================================

async function checkAuth() {
    try {
        const data = await getJSON("/api/me");

        displayUser(data.user);

        siteHeader.style.display = "none";
        authSection.style.display = "none";
        appSection.style.display = "grid";

        showPage("dashboard");

        await Promise.all([
            loadAvailableBalance(),
            refreshManage()
        ]);
    } catch (error) {
        authSection.style.display = "block";
        appSection.style.display = "none";
        siteHeader.style.display = "block";
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const data = await getJSON("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        displayUser(data.user);

        siteHeader.style.display = "none";
        authSection.style.display = "none";
        appSection.style.display = "grid";

        loginForm.reset();
        loginMessage.textContent = "";

        showPage("dashboard");
        await refreshManage();
    } catch (error) {
        loginMessage.textContent = error.message;
    }
});

registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    try {
        await getJSON("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        registerMessage.textContent =
            "Registration successful! Please login.";

        registerForm.reset();
    } catch (error) {
        registerMessage.textContent = error.message;
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await getJSON("/api/logout", {
            method: "POST"
        });

        appSection.style.display = "none";
        authSection.style.display = "block";
        siteHeader.style.display = "block";

        loginMessage.textContent = "You have been logged out.";
        allTransactions = [];
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// =========================================
// WALLET
// =========================================

async function loadAvailableBalance() {
    const balanceElement = document.getElementById("availableBalance");
    const walletSetup = document.getElementById("walletSetup");
    const walletSection = document.querySelector(
        "#dashboardPage .wallet-section"
    );

    if (!balanceElement || !walletSetup || !walletSection) return;

    try {
        const response = await fetch("/api/wallet/balance");
        const data = await response.json();

        if (
            response.status === 404 &&
            data.message === "Wallet not found."
        ) {
            walletSetup.hidden = false;
            walletSection.hidden = true;
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Wallet error.");
        }

        walletSetup.hidden = true;
        walletSection.hidden = false;
        balanceElement.textContent = formatMoney(data.availableBalance);
    } catch (error) {
        console.error("Wallet error:", error);
        walletSetup.hidden = true;
        walletSection.hidden = false;
        balanceElement.textContent = "Unavailable";
    }
}

const walletSetupForm = document.getElementById("walletSetupForm");

walletSetupForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const amount = document.getElementById("startingBalance").value;
    const message = document.getElementById("walletSetupMessage");
    const button = walletSetupForm.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;
    message.textContent = "Creating wallet...";

    try {
        await getJSON("/api/wallet", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                initial_balance: amount
            })
        });

        message.textContent = "";
        await loadAvailableBalance();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

// =========================================
// DASHBOARD
// =========================================

async function loadDashboard() {
    try {
        const data = await getJSON(
            `/api/dashboard/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const dashboard = data.data;

        document.getElementById("income").textContent =
            formatMoney(dashboard.totalIncome);

        document.getElementById("expenses").textContent =
            formatMoney(dashboard.totalExpenses);

        document.getElementById("remaining").textContent =
            formatMoney(dashboard.remaining);

        updateMonthTitle();
    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

// =========================================
// SHARED HISTORY UI
// =========================================

function createHistoryItem(transaction, type) {
    const isIncome = type === "income";

    const item = document.createElement("div");
    item.className = `mw-history-item ${type}`;

    const icon = document.createElement("span");
    icon.className = "mw-history-icon";
    icon.textContent = isIncome ? "↙" : "↗";
    icon.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    info.className = "mw-history-info";

    const title = document.createElement("h4");
    title.textContent = transaction.category || "Other";

    const details = document.createElement("p");

    const dateValue = isIncome
        ? transaction.income_date
        : transaction.expense_date;

    details.textContent =
        `${formatTransactionDate(dateValue)} · ` +
        `${transaction.description || "No description"}`;

    info.append(title, details);

    const right = document.createElement("div");
    right.className = "mw-history-right";

    const amount = document.createElement("strong");
    amount.className = "mw-history-amount";
    amount.textContent =
        `${isIncome ? "+" : "−"}${formatMoney(transaction.amount)}`;

    const actions = document.createElement("div");
    actions.className = "mw-history-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "mw-edit-btn";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
        if (isIncome) {
            editIncome(transaction.id);
        } else {
            editExpense(transaction.id);
        }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "mw-delete-btn";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
        if (isIncome) {
            deleteIncome(transaction.id);
        } else {
            deleteExpense(transaction.id);
        }
    });

    actions.append(editButton, deleteButton);
    right.append(amount, actions);
    item.append(icon, info, right);

    return item;
}

// =========================================
// LOAD INCOME HISTORY
// =========================================

async function loadIncome() {
    const history = document.getElementById("incomeHistory");

    try {
        const data = await getJSON(
            `/api/income/me?year=${selectedYear}&month=${selectedMonth}`
        );

        history.replaceChildren();

        if (!data.data.length) {
            history.textContent = "No income for this month.";
            return;
        }

        data.data.forEach(income => {
            history.appendChild(
                createHistoryItem(income, "income")
            );
        });
    } catch (error) {
        console.error("Income history error:", error);
        history.textContent = "Failed to load income.";
    }
}

// =========================================
// LOAD EXPENSE HISTORY
// =========================================

async function loadExpenses() {
    const history = document.getElementById("expenseHistory");

    try {
        const data = await getJSON(
            `/api/expenses/me?year=${selectedYear}&month=${selectedMonth}`
        );

        history.replaceChildren();

        if (!data.data.length) {
            history.textContent = "No expenses for this month.";
            return;
        }

        data.data.forEach(expense => {
            history.appendChild(
                createHistoryItem(expense, "expense")
            );
        });
    } catch (error) {
        console.error("Expense history error:", error);
        history.textContent = "Failed to load expenses.";
    }
}

// =========================================
// ADD INCOME
// =========================================

const incomeForm = document.getElementById("incomeForm");

incomeForm.addEventListener("submit", async event => {
    event.preventDefault();

    const incomeData = {
        category_id: Number(
            document.getElementById("incomeCategory").value
        ),
        amount: Number(
            document.getElementById("incomeAmount").value
        ),
        description: document.getElementById("incomeDescription").value,
        income_date: document.getElementById("incomeDate").value
    };

    const message = document.getElementById("incomeMessage");

    try {
        await getJSON("/api/income", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(incomeData)
        });

        incomeForm.reset();
        message.textContent = "Income added successfully!";

        await Promise.all([
            refreshManage(),
            loadAvailableBalance()
        ]);

        showNotification(
            `${getCurrentMonthName()} income updated!`
        );
    } catch (error) {
        console.error("Add income error:", error);
        message.textContent = error.message;
    }
});

// =========================================
// ADD EXPENSE
// =========================================

const expenseForm = document.getElementById("expenseForm");

expenseForm.addEventListener("submit", async event => {
    event.preventDefault();

    const expenseData = {
        category_id: Number(
            document.getElementById("expenseCategory").value
        ),
        amount: Number(
            document.getElementById("expenseAmount").value
        ),
        description: document.getElementById("expenseDescription").value,
        expense_date: document.getElementById("expenseDate").value
    };

    const message = document.getElementById("expenseMessage");

    try {
        await getJSON("/api/expenses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(expenseData)
        });

        expenseForm.reset();
        message.textContent = "Expense added successfully!";

        await Promise.all([
            refreshManage(),
            loadAvailableBalance()
        ]);
    } catch (error) {
        console.error("Add expense error:", error);
        message.textContent = error.message;
    }
});

// =========================================
// CATEGORY HELPERS
// =========================================

function getCategoryId(category) {
    const categories = {
        Food: 5,
        Drink: 6,
        Cigarette: 7,
        Alcohol: 8,
        Transportation: 9,
        Shopping: 10,
        Entertainment: 11,
        Healthcare: 12,
        Rent: 13,
        Electricity: 14,
        Water: 15,
        Phone: 16,
        Insurance: 17,
        Tax: 18,
        Groceries: 19,
        Other: 20
    };

    return categories[category];
}

function getIncomeCategoryId(category) {
    const categories = {
        Salary: 1,
        "Part-time Job": 2,
        Bonus: 3,
        "Other Income": 4
    };

    return categories[category];
}

// =========================================
// EDIT EXPENSE
// =========================================

async function editExpense(id) {
    try {
        const data = await getJSON("/api/expenses/me");

        const expense = data.data.find(
            item => Number(item.id) === Number(id)
        );

        if (!expense) {
            alert("Expense not found.");
            return;
        }

        editingExpenseId = id;

        document.getElementById("editExpenseCategory").value =
            getCategoryId(expense.category);

        document.getElementById("editExpenseAmount").value =
            expense.amount;

        document.getElementById("editExpenseDescription").value =
            expense.description || "";

        document.getElementById("editExpenseDate").value =
            formatDateForInput(expense.expense_date);

        document.getElementById("editModal").style.display = "flex";
    } catch (error) {
        console.error("Edit expense error:", error);
        alert(error.message);
    }
}

function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
    editingExpenseId = null;
}

document.getElementById("editExpenseForm")
    .addEventListener("submit", async event => {
        event.preventDefault();
        if (editingExpenseId === null) return;

        const expenseData = {
            category_id: Number(
                document.getElementById("editExpenseCategory").value
            ),
            amount: Number(
                document.getElementById("editExpenseAmount").value
            ),
            description: document.getElementById("editExpenseDescription").value,
            expense_date: document.getElementById("editExpenseDate").value
        };

        try {
            await getJSON(`/api/expenses/${editingExpenseId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(expenseData)
            });

            closeEditModal();

            await Promise.all([
                refreshManage(),
                loadAvailableBalance()
            ]);
        } catch (error) {
            console.error("Update expense error:", error);
            alert(error.message);
        }
    });

// =========================================
// DELETE EXPENSE
// =========================================

async function deleteExpense(id) {
    if (!confirm("Delete this expense?")) return;

    try {
        await getJSON(`/api/expenses/${id}`, {
            method: "DELETE"
        });

        await Promise.all([
            refreshManage(),
            loadAvailableBalance()
        ]);
    } catch (error) {
        console.error("Delete expense error:", error);
        alert(error.message);
    }
}

// =========================================
// EDIT INCOME
// =========================================

async function editIncome(id) {
    try {
        const data = await getJSON("/api/income/me");

        const income = data.data.find(
            item => Number(item.id) === Number(id)
        );

        if (!income) {
            alert("Income not found.");
            return;
        }

        editingIncomeId = id;

        document.getElementById("editIncomeCategory").value =
            getIncomeCategoryId(income.category);

        document.getElementById("editIncomeAmount").value =
            income.amount;

        document.getElementById("editIncomeDescription").value =
            income.description || "";

        document.getElementById("editIncomeDate").value =
            formatDateForInput(income.income_date);

        document.getElementById("editIncomeModal").style.display = "flex";
    } catch (error) {
        console.error("Edit income error:", error);
        alert(error.message);
    }
}

function closeIncomeModal() {
    document.getElementById("editIncomeModal").style.display = "none";
    editingIncomeId = null;
}

document.getElementById("editIncomeForm")
    .addEventListener("submit", async event => {
        event.preventDefault();
        if (editingIncomeId === null) return;

        const incomeData = {
            category_id: Number(
                document.getElementById("editIncomeCategory").value
            ),
            amount: Number(
                document.getElementById("editIncomeAmount").value
            ),
            description: document.getElementById("editIncomeDescription").value,
            income_date: document.getElementById("editIncomeDate").value
        };

        try {
            await getJSON(`/api/income/${editingIncomeId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(incomeData)
            });

            closeIncomeModal();

            await Promise.all([
                refreshManage(),
                loadAvailableBalance()
            ]);
        } catch (error) {
            console.error("Update income error:", error);
            alert(error.message);
        }
    });

// =========================================
// DELETE INCOME
// =========================================

async function deleteIncome(id) {
    if (!confirm("Delete this income?")) return;

    try {
        await getJSON(`/api/income/${id}`, {
            method: "DELETE"
        });

        await Promise.all([
            refreshManage(),
            loadAvailableBalance()
        ]);
    } catch (error) {
        console.error("Delete income error:", error);
        alert(error.message);
    }
}

// =========================================
// EXPENSE BREAKDOWN
// =========================================

async function loadExpenseBreakdown() {
    const container = document.getElementById("expenseBreakdown");

    try {
        const data = await getJSON(
            `/api/expenses/breakdown/me?year=${selectedYear}&month=${selectedMonth}`
        );

        container.replaceChildren();

        if (!data.data.length) {
            container.textContent = "No expenses for this month.";
            return;
        }

        const total = data.data.reduce(
            (sum, item) => sum + Number(item.total),
            0
        );

        data.data.forEach(item => {
            const amount = Number(item.total);
            const percentage = total > 0
                ? (amount / total) * 100
                : 0;

            const card = document.createElement("div");
            card.className = "breakdown-item";

            const heading = document.createElement("div");
            heading.className = "breakdown-header";

            const title = document.createElement("h4");
            title.textContent = item.category;

            const strong = document.createElement("strong");
            strong.textContent = formatMoney(amount);

            heading.append(title, strong);

            const bar = document.createElement("div");
            bar.className = "breakdown-bar";

            const progress = document.createElement("div");
            progress.className = "breakdown-progress";
            progress.style.width = `${percentage}%`;

            bar.appendChild(progress);

            const percent = document.createElement("p");
            percent.textContent = `${percentage.toFixed(1)}%`;

            card.append(heading, bar, percent);
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Expense breakdown error:", error);
        container.textContent = "Failed to load breakdown.";
    }
}

// =========================================
// INCOME / EXPENSE CHART
// =========================================

async function loadIncomeExpenseChart() {
    try {
        const data = await getJSON(
            `/api/dashboard/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const dashboard = data.data;
        const canvas = document.getElementById("incomeExpenseChart");

        if (!canvas) return;

        if (incomeExpenseChart) {
            incomeExpenseChart.destroy();
        }

        incomeExpenseChart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: ["Income", "Expenses"],
                datasets: [{
                    label: `${selectedYear}/${selectedMonth}`,
                    data: [
                        Number(dashboard.totalIncome),
                        Number(dashboard.totalExpenses)
                    ],
                    backgroundColor: ["#16875b", "#e17a7a"],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback(value) {
                                return formatMoney(value);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Chart error:", error);
    }
}

// =========================================
// TRANSACTIONS
// =========================================

// =========================================
// ALL MONTHS TRANSACTION HISTORY
// =========================================

let activeTransactionFilter = "all";

// LOAD ALL TRANSACTIONS
async function loadTransactions() {
    const list = document.getElementById("transactionsList");

    list.textContent = "Loading transactions...";

    try {
        // No year/month = all records
        const [incomeData, expenseData] = await Promise.all([
            getJSON("/api/income/me"),
            getJSON("/api/expenses/me")
        ]);

        const incomes = incomeData.data.map(income => ({
            ...income,
            type: "income",
            date: income.income_date
        }));

        const expenses = expenseData.data.map(expense => ({
            ...expense,
            type: "expense",
            date: expense.expense_date
        }));

        // Combine income and expenses
        allTransactions = [...incomes, ...expenses];

        // Latest date first
        allTransactions.sort((a, b) => {
            const dateA = formatTransactionDate(a.date);
            const dateB = formatTransactionDate(b.date);

            return dateB.localeCompare(dateA);
        });

        filterTransactions();

    } catch (error) {
        console.error("Transaction loading error:", error);

        list.textContent =
            "Failed to load transactions. Please try again.";
    }
}


// =========================================
// RENDER TRANSACTIONS
// =========================================

function renderTransactions(transactions) {
    const list = document.getElementById("transactionsList");

    const count = document.getElementById("transactionCount");

    list.replaceChildren();

    count.textContent =
        `${transactions.length} transaction` +
        (transactions.length === 1 ? "" : "s");

    if (transactions.length === 0) {
        const empty = document.createElement("p");
        empty.className = "transactions-empty";
        empty.textContent = "No matching transactions found.";

        list.appendChild(empty);
        return;
    }

    transactions.forEach(transaction => {
        const item = createHistoryItem(
            transaction,
            transaction.type
        );

        list.appendChild(item);
    });
}


// =========================================
// SEARCH + TYPE + DATE RANGE
// =========================================

function filterTransactions() {
    const searchText = document
        .getElementById("transactionSearch")
        .value
        .trim()
        .toLowerCase();

    const fromDate = document
        .getElementById("transactionFromDate")
        .value;

    const toDate = document
        .getElementById("transactionToDate")
        .value;

    const filtered = allTransactions.filter(transaction => {
        const transactionDate =
            formatTransactionDate(transaction.date);

        // 1. TYPE FILTER
        const matchesType =
            activeTransactionFilter === "all" ||
            transaction.type === activeTransactionFilter;

        // 2. SEARCH FILTER
        const category = String(
            transaction.category || ""
        ).toLowerCase();

        const description = String(
            transaction.description || ""
        ).toLowerCase();

        const matchesSearch =
            category.includes(searchText) ||
            description.includes(searchText) ||
            transactionDate.includes(searchText);

        // 3. DATE RANGE FILTER
        // Both boundaries are inclusive
        const matchesFrom =
            !fromDate || transactionDate >= fromDate;

        const matchesTo =
            !toDate || transactionDate <= toDate;

        return (
            matchesType &&
            matchesSearch &&
            matchesFrom &&
            matchesTo
        );
    });

    renderTransactions(filtered);
}


// =========================================
// FILTER BUTTONS
// =========================================

document.querySelectorAll(".transaction-filter")
    .forEach(button => {
        button.addEventListener("click", () => {
            activeTransactionFilter = button.dataset.filter;

            document.querySelectorAll(".transaction-filter")
                .forEach(item => {
                    const isActive = item === button;

                    item.classList.toggle("active", isActive);
                    item.setAttribute(
                        "aria-pressed",
                        String(isActive)
                    );
                });

            filterTransactions();
        });
    });


// =========================================
// SEARCH INPUT
// =========================================

document.getElementById("transactionSearch")
    .addEventListener("input", filterTransactions);


// =========================================
// DATE INPUTS
// =========================================

document.getElementById("transactionFromDate")
    .addEventListener("change", filterTransactions);

document.getElementById("transactionToDate")
    .addEventListener("change", filterTransactions);


// =========================================
// CLEAR ALL FILTERS
// =========================================

document.getElementById("clearTransactionFilters")
    .addEventListener("click", () => {

        document.getElementById("transactionSearch").value = "";
        document.getElementById("transactionFromDate").value = "";
        document.getElementById("transactionToDate").value = "";

        activeTransactionFilter = "all";

        document.querySelectorAll(".transaction-filter")
            .forEach(button => {
                const active = button.dataset.filter === "all";

                button.classList.toggle("active", active);

                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );
            });

        filterTransactions();
    });
// =========================================
// MONTH NAVIGATION
// =========================================

async function refreshManage() {
    await Promise.allSettled([
        loadDashboard(),
        loadIncome(),
        loadExpenses(),
        loadExpenseBreakdown(),
        loadIncomeExpenseChart()
    ]);
}

document.getElementById("previousMonth")
    .addEventListener("click", async () => {
        selectedMonth--;

        if (selectedMonth < 1) {
            selectedMonth = 12;
            selectedYear--;
        }

        updateMonthTitle();
        await refreshManage();
    });

document.getElementById("nextMonth")
    .addEventListener("click", async () => {
        selectedMonth++;

        if (selectedMonth > 12) {
            selectedMonth = 1;
            selectedYear++;
        }

        updateMonthTitle();
        await refreshManage();
    });

// =========================================
// INCOME / EXPENSE TABS
// =========================================

const entryTabs = document.querySelectorAll(".entry-tab");

entryTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const type = tab.dataset.entry;

        document.getElementById("incomeEntry").hidden =
            type !== "income";

        document.getElementById("expenseEntry").hidden =
            type !== "expense";

        entryTabs.forEach(button => {
            button.classList.toggle(
                "active",
                button === tab
            );
        });
    });
});

async function refreshTransactionsIfVisible() {
    const page = document.getElementById("transactionsPage");

    if (page && !page.hidden) {
        await loadTransactions();
    }
}

// ==========================================
// PROFILE / SETTINGS FRONTEND
// ==========================================

let moneyWisePreferences = {
    theme: "light",
    language: "en",
    notifications_enabled: true
};

// Open settings panel
document.querySelectorAll("[data-settings-target]")
    .forEach(button => {

        button.addEventListener("click", () => {

            const target = button.dataset.settingsTarget;

            showPage("settings");

            document.querySelectorAll(".mw-panel")
                .forEach(panel => {
                    panel.hidden = panel.id !== target;
                });

        });
    });


// LOAD PROFILE
async function loadProfile() {
    try {
        const response = await fetch("/api/profile");
        const data = await response.json();

        if (!response.ok || !data.success) return;

        const user = data.user;

        document.getElementById("profileName").textContent =
            user.name;

        document.getElementById("profileEmail").textContent =
            user.email;

        document.getElementById("profileAvatar").textContent =
            user.name.charAt(0).toUpperCase();

        document.getElementById("profileNameInput").value =
            user.name;

        document.getElementById("profileEmailInput").value =
            user.email;

    } catch (error) {
        console.error("Load profile error:", error);
    }
}


// SAVE PROFILE
document.getElementById("profileForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const name = document
            .getElementById("profileNameInput")
            .value.trim();

        const message = document.getElementById(
            "profileMessage"
        );

        try {
            const response = await fetch("/api/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message);
            }

            message.textContent = "Profile updated successfully.";

            await loadProfile();

            const meResponse = await fetch("/api/me");
            const meData = await meResponse.json();

            if (meData.success) {
                displayUser(meData.user);
            }

        } catch (error) {
            message.textContent = error.message;
        }
    });


// APPLY THEME
function applyMoneyWiseTheme(theme) {
    document.documentElement.dataset.theme = theme;

    document.getElementById("themePreview").textContent =
        theme === "dark" ? "Dark" : "Light";
}


// APPLY LANGUAGE PREFERENCE
function applyMoneyWiseLanguage(language) {
    document.documentElement.lang = language;

    const names = {
        en: "English",
        ja: "日本語",
        my: "မြန်မာဘာသာ",
        zh: "中文"
    };

    document.getElementById("languagePreview").textContent =
        names[language] || "English";
}


// LOAD PREFERENCES
async function loadPreferences() {
    try {
        const response = await fetch("/api/preferences");
        const data = await response.json();

        if (!response.ok || !data.success) return;

        moneyWisePreferences = {
            theme: data.preferences.theme,
            language: data.preferences.language,
            notifications_enabled:
                Boolean(data.preferences.notifications_enabled)
        };

        document.getElementById("themeSelect").value =
            moneyWisePreferences.theme;

        document.getElementById("languageSelect").value =
            moneyWisePreferences.language;

        document.getElementById("notificationsEnabled").checked =
            moneyWisePreferences.notifications_enabled;

        applyMoneyWiseTheme(moneyWisePreferences.theme);
        applyMoneyWiseLanguage(moneyWisePreferences.language);

    } catch (error) {
        console.error("Load preferences error:", error);
    }
}


// SAVE PREFERENCES
async function savePreferences() {
    const message = document.getElementById(
        "preferencesMessage"
    );

    try {
        const response = await fetch("/api/preferences", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(moneyWisePreferences)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        message.textContent = "Preferences saved.";

    } catch (error) {
        message.textContent = error.message;
    }
}


// SETTINGS EVENTS
document.getElementById("themeSelect")
    .addEventListener("change", event => {

        moneyWisePreferences.theme = event.target.value;

        applyMoneyWiseTheme(moneyWisePreferences.theme);
        savePreferences();
    });

document.getElementById("languageSelect")
    .addEventListener("change", event => {

        moneyWisePreferences.language = event.target.value;

        applyMoneyWiseLanguage(moneyWisePreferences.language);
        savePreferences();
    });

document.getElementById("notificationsEnabled")
    .addEventListener("change", event => {

        moneyWisePreferences.notifications_enabled =
            event.target.checked;

        savePreferences();
    });

// =========================================
// START APPLICATION
// =========================================

updateMonthTitle();
checkAuth();
