// ======================================================
// AUTH ELEMENTS
// ======================================================

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const logoutButton = document.getElementById("logoutButton");
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");


// ======================================================
// DATE / MONTH STATE
// ======================================================

const today = new Date();

let selectedYear = today.getFullYear();
let selectedMonth = today.getMonth() + 1;


// ======================================================
// CHECK AUTH
// ======================================================

async function checkAuth() {
    try {
        const response = await fetch("/api/me");

        const data = await response.json();

        if (data.success) {
            authSection.style.display = "none";
            appSection.style.display = "block";

            await loadDashboard();
            await loadIncome();
            await loadExpenses();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();

        } else {
            authSection.style.display = "block";
            appSection.style.display = "none";
        }

    } catch (error) {
        console.error("Auth check error:", error);

        authSection.style.display = "block";
        appSection.style.display = "none";
    }
}


// ======================================================
// LOGIN
// ======================================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email =
        document.getElementById("loginEmail").value;

    const password =
        document.getElementById("loginPassword").value;

    try {
        const response = await fetch("/api/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            loginMessage.textContent =
                "Login successful!";

            authSection.style.display = "none";
            appSection.style.display = "block";

            loginForm.reset();

            await loadDashboard();
            await loadIncome();
            await loadExpenses();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();

        } else {
            loginMessage.textContent =
                data.message || "Login failed.";
        }

    } catch (error) {
        console.error("Login error:", error);

        loginMessage.textContent =
            "Server error.";
    }
});
// ======================================================
// LOGOUT
// ======================================================

logoutButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });

        const data = await response.json();

        if (data.success) {
            appSection.style.display = "none";
            authSection.style.display = "block";

            loginMessage.textContent = "You have been logged out.";
        }
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// ======================================================
// REGISTER
// ======================================================

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name =
        document.getElementById("registerName").value;

    const email =
        document.getElementById("registerEmail").value;

    const password =
        document.getElementById("registerPassword").value;

    try {
        const response = await fetch("/api/register", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            registerMessage.textContent =
                "Registration successful! Please login.";

            registerForm.reset();

        } else {
            registerMessage.textContent =
                data.message || "Registration failed.";
        }

    } catch (error) {
        console.error("Register error:", error);

        registerMessage.textContent =
            "Server error.";
    }
});


// ======================================================
// DASHBOARD
// ======================================================

async function loadDashboard() {
    try {
        const response = await fetch(
            `/api/dashboard/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const data = await response.json();

        if (!data.success) {
            console.error(
                "Failed to load dashboard:",
                data.message
            );

            return;
        }

        const dashboard = data.data;

        document.getElementById("income").textContent =
            `¥${Number(dashboard.totalIncome).toLocaleString()}`;

        document.getElementById("expenses").textContent =
            `¥${Number(dashboard.totalExpenses).toLocaleString()}`;

        document.getElementById("remaining").textContent =
            `¥${Number(dashboard.remaining).toLocaleString()}`;

        updateMonthTitle();

    } catch (error) {
        console.error(
            "Dashboard error:",
            error
        );
    }
}


// ======================================================
// ADD INCOME
// ======================================================

const incomeForm =
    document.getElementById("incomeForm");

incomeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const categoryId =
        document.getElementById("incomeCategory").value;

    const amount =
        document.getElementById("incomeAmount").value;

    const description =
        document.getElementById("incomeDescription").value;

    const incomeDate =
        document.getElementById("incomeDate").value;

    const incomeData = {
        category_id: Number(categoryId),
        amount: Number(amount),
        description,
        income_date: incomeDate
    };

    try {
        const response = await fetch("/api/income", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(incomeData)
        });

        const data = await response.json();

        const message =
            document.getElementById("incomeMessage");

        if (data.success) {
            message.textContent =
                "Income added successfully!";

            incomeForm.reset();

            await loadDashboard();
            await loadIncome();
            await loadIncomeExpenseChart();

            showNotification(
                `💰 ${getCurrentMonthName()} income updated!`
            );

        } else {
            message.textContent =
                data.message || "Failed to add income.";
        }

    } catch (error) {
        console.error("Add income error:", error);

        document.getElementById("incomeMessage")
            .textContent = "Server error.";
    }
});


// ======================================================
// ADD EXPENSE
// ======================================================

const expenseForm =
    document.getElementById("expenseForm");

expenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const categoryId =
        document.getElementById("expenseCategory").value;

    const amount =
        document.getElementById("expenseAmount").value;

    const description =
        document.getElementById("expenseDescription").value;

    const expenseDate =
        document.getElementById("expenseDate").value;

    const expenseData = {
        category_id: Number(categoryId),
        amount: Number(amount),
        description,
        expense_date: expenseDate
    };

    try {
        const response = await fetch("/api/expenses", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(expenseData)
        });

        const data = await response.json();

        const message =
            document.getElementById("expenseMessage");

        if (data.success) {
            message.textContent =
                "Expense added successfully!";

            expenseForm.reset();

            await loadDashboard();
            await loadExpenses();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();

        } else {
            message.textContent =
                data.message || "Failed to add expense.";
        }

    } catch (error) {
        console.error("Add expense error:", error);

        document.getElementById("expenseMessage")
            .textContent = "Server error.";
    }
});


// ======================================================
// LOAD EXPENSE HISTORY
// ======================================================

async function loadExpenses() {
    try {
        const response = await fetch(
            `/api/expenses/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const data = await response.json();

        const history =
            document.getElementById("expenseHistory");

        history.innerHTML = "";

        if (!data.success) {
            history.innerHTML =
                "<p>Failed to load expenses.</p>";

            return;
        }

        if (data.data.length === 0) {
            history.innerHTML =
                "<p>No expenses for this month.</p>";

            return;
        }

        data.data.forEach((expense) => {
            const item =
                document.createElement("div");

            item.className = "expense-item";

            item.innerHTML = `
                <div class="expense-info">
                    <h4>${expense.category}</h4>

                    <p>
                        ${expense.description || "No description"}
                        · ${expense.expense_date}
                    </p>
                </div>

                <div class="expense-actions">
                    <strong>
                        ¥${Number(expense.amount).toLocaleString()}
                    </strong>

                    <button
                        class="edit-btn"
                        onclick="editExpense(${expense.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteExpense(${expense.id})"
                    >
                        Delete
                    </button>
                </div>
            `;

            history.appendChild(item);
        });

    } catch (error) {
        console.error(
            "Expense history error:",
            error
        );
    }
}


// ======================================================
// EXPENSE BREAKDOWN
// ======================================================

async function loadExpenseBreakdown() {
    try {
        const response = await fetch(
            `/api/expenses/breakdown/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const data = await response.json();

        const breakdown =
            document.getElementById("expenseBreakdown");

        breakdown.innerHTML = "";

        if (!data.success) {
            breakdown.innerHTML =
                "<p>Failed to load breakdown.</p>";

            return;
        }

        if (data.data.length === 0) {
            breakdown.innerHTML =
                "<p>No expenses for this month.</p>";

            return;
        }

        const totalExpenses =
            data.data.reduce(
                (sum, item) =>
                    sum + Number(item.total),
                0
            );

        data.data.forEach((item) => {
            const amount =
                Number(item.total);

            const percentage =
                totalExpenses > 0
                    ? (amount / totalExpenses) * 100
                    : 0;

            const card =
                document.createElement("div");

            card.className = "breakdown-item";

            card.innerHTML = `
                <div class="breakdown-header">
                    <h4>${item.category}</h4>

                    <strong>
                        ¥${amount.toLocaleString()}
                    </strong>
                </div>

                <div class="breakdown-bar">
                    <div
                        class="breakdown-progress"
                        style="width: ${percentage}%"
                    ></div>
                </div>

                <p>
                    ${percentage.toFixed(1)}%
                </p>
            `;

            breakdown.appendChild(card);
        });

    } catch (error) {
        console.error(
            "Expense breakdown error:",
            error
        );
    }
}


// ======================================================
// DELETE EXPENSE
// ======================================================

async function deleteExpense(id) {
    const confirmed =
        confirm(
            "Are you sure you want to delete this expense?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `/api/expenses/${id}`,
            {
                method: "DELETE"
            }
        );

        const data =
            await response.json();

        if (data.success) {
            await loadExpenses();
            await loadDashboard();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();

        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error(error);

        alert(
            "Failed to delete expense."
        );
    }
}


// ======================================================
// EDIT EXPENSE
// ======================================================

let editingExpenseId = null;

async function editExpense(id) {
    try {
        const response =
            await fetch("/api/expenses/me");

        const data =
            await response.json();

        if (!data.success) {
            alert(
                "Failed to load expense."
            );

            return;
        }

        const expense =
            data.data.find(
                item => item.id === id
            );

        if (!expense) {
            alert("Expense not found.");
            return;
        }

        editingExpenseId = id;

        document.getElementById(
            "editExpenseCategory"
        ).value =
            getCategoryId(
                expense.category
            );

        document.getElementById(
            "editExpenseAmount"
        ).value =
            expense.amount;

        document.getElementById(
            "editExpenseDescription"
        ).value =
            expense.description || "";

        document.getElementById(
            "editExpenseDate"
        ).value =
            formatDateForInput(
                expense.expense_date
            );

        document.getElementById(
            "editModal"
        ).style.display = "flex";

    } catch (error) {
        console.error(error);

        alert(
            "Failed to load expense."
        );
    }
}


// ======================================================
// EXPENSE CHART
// ======================================================

let incomeExpenseChart = null;

async function loadIncomeExpenseChart() {
    try {
        const response = await fetch(
            `/api/dashboard/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const data =
            await response.json();

        if (!data.success) {
            return;
        }

        const dashboard =
            data.data;

        const canvas =
            document.getElementById(
                "incomeExpenseChart"
            );

        if (!canvas) {
            return;
        }

        const ctx =
            canvas.getContext("2d");

        if (incomeExpenseChart) {
            incomeExpenseChart.destroy();
        }

        incomeExpenseChart =
            new Chart(ctx, {
                type: "bar",

                data: {
                    labels: [
                        "Income",
                        "Expenses"
                    ],

                    datasets: [{
                        label:
                            `${selectedYear}/${selectedMonth}`,

                        data: [
                            dashboard.totalIncome,
                            dashboard.totalExpenses
                        ]
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
                                callback:
                                    function (value) {
                                        return "¥" +
                                            Number(value)
                                                .toLocaleString();
                                    }
                            }
                        }
                    }
                }
            });

    } catch (error) {
        console.error(
            "Income expense chart error:",
            error
        );
    }
}


// ======================================================
// EXPENSE CATEGORY ID
// ======================================================

function getCategoryId(category) {
    const categories = {
        "Food": 5,
        "Drink": 6,
        "Cigarette": 7,
        "Alcohol": 8,
        "Transportation": 9,
        "Shopping": 10,
        "Entertainment": 11,
        "Healthcare": 12,
        "Rent": 13,
        "Electricity": 14,
        "Water": 15,
        "Phone": 16,
        "Insurance": 17,
        "Tax": 18,
        "Groceries": 19,
        "Other": 20
    };

    return categories[category];
}


// ======================================================
// DATE FORMAT
// ======================================================

function formatDateForInput(date) {
    return date.split("T")[0];
}


// ======================================================
// CLOSE EXPENSE MODAL
// ======================================================

function closeEditModal() {
    document.getElementById(
        "editModal"
    ).style.display = "none";

    editingExpenseId = null;
}


// ======================================================
// UPDATE EXPENSE
// ======================================================

const editExpenseForm =
    document.getElementById(
        "editExpenseForm"
    );

editExpenseForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        if (!editingExpenseId) {
            return;
        }

        const expenseData = {
            category_id: Number(
                document.getElementById(
                    "editExpenseCategory"
                ).value
            ),

            amount: Number(
                document.getElementById(
                    "editExpenseAmount"
                ).value
            ),

            description:
                document.getElementById(
                    "editExpenseDescription"
                ).value,

            expense_date:
                document.getElementById(
                    "editExpenseDate"
                ).value
        };

        try {
            const response =
                await fetch(
                    `/api/expenses/${editingExpenseId}`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                expenseData
                            )
                    }
                );

            const data =
                await response.json();

            if (data.success) {
                closeEditModal();

                await loadExpenses();
                await loadDashboard();
                await loadExpenseBreakdown();
                await loadIncomeExpenseChart();

            } else {
                alert(data.message);
            }

        } catch (error) {
            console.error(error);

            alert(
                "Failed to update expense."
            );
        }
    }
);


// ======================================================
// MONTH TITLE
// ======================================================

const monthTitle =
    document.getElementById(
        "monthTitle"
    );

function updateMonthTitle() {
    const date =
        new Date(
            selectedYear,
            selectedMonth - 1
        );

    const monthName =
        date.toLocaleString(
            "en-US",
            {
                month: "long"
            }
        );

    monthTitle.textContent =
        `${monthName} ${selectedYear}`;
}


// ======================================================
// PREVIOUS MONTH
// ======================================================

document
    .getElementById("previousMonth")
    .addEventListener(
        "click",
        async () => {
            selectedMonth--;

            if (selectedMonth === 0) {
                selectedMonth = 12;
                selectedYear--;
            }

            updateMonthTitle();

            await loadDashboard();
            await loadExpenses();
            await loadIncome();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();
        }
    );


// ======================================================
// NEXT MONTH
// ======================================================

document
    .getElementById("nextMonth")
    .addEventListener(
        "click",
        async () => {
            selectedMonth++;

            if (selectedMonth === 13) {
                selectedMonth = 1;
                selectedYear++;
            }

            updateMonthTitle();

            await loadDashboard();
            await loadExpenses();
            await loadIncome();
            await loadExpenseBreakdown();
            await loadIncomeExpenseChart();
        }
    );


// ======================================================
// LOAD INCOME HISTORY
// ======================================================

async function loadIncome() {
    try {
        const response = await fetch(
            `/api/income/me?year=${selectedYear}&month=${selectedMonth}`
        );

        const data =
            await response.json();

        const history =
            document.getElementById(
                "incomeHistory"
            );

        history.innerHTML = "";

        if (!data.success) {
            history.innerHTML =
                "<p>Failed to load income.</p>";

            return;
        }

        if (data.data.length === 0) {
            history.innerHTML =
                "<p>No income for this month.</p>";

            return;
        }

        data.data.forEach((income) => {
            const item =
                document.createElement("div");

            item.className =
                "income-item";

            item.innerHTML = `
                <div class="income-info">
                    <h4>${income.category}</h4>

                    <p>
                        ${income.description || "No description"}
                        · ${income.income_date}
                    </p>
                </div>

                <div class="income-actions">
                    <strong>
                        +¥${Number(income.amount).toLocaleString()}
                    </strong>

                    <button
                        class="edit-btn"
                        onclick="editIncome(${income.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteIncome(${income.id})"
                    >
                        Delete
                    </button>
                </div>
            `;

            history.appendChild(item);
        });

    } catch (error) {
        console.error(
            "Income history error:",
            error
        );
    }
}


// ======================================================
// EDIT INCOME
// ======================================================

let editingIncomeId = null;

async function editIncome(id) {
    try {
        const response =
            await fetch("/api/income/me");

        const data =
            await response.json();

        if (!data.success) {
            alert(
                "Failed to load income."
            );

            return;
        }

        const income =
            data.data.find(
                item => item.id === id
            );

        if (!income) {
            alert("Income not found.");
            return;
        }

        editingIncomeId = id;

        document.getElementById(
            "editIncomeCategory"
        ).value =
            getIncomeCategoryId(
                income.category
            );

        document.getElementById(
            "editIncomeAmount"
        ).value =
            income.amount;

        document.getElementById(
            "editIncomeDescription"
        ).value =
            income.description || "";

        document.getElementById(
            "editIncomeDate"
        ).value =
            formatDateForInput(
                income.income_date
            );

        document.getElementById(
            "editIncomeModal"
        ).style.display = "flex";

    } catch (error) {
        console.error(error);

        alert(
            "Failed to load income."
        );
    }
}


// ======================================================
// INCOME CATEGORY ID
// ======================================================

function getIncomeCategoryId(category) {
    const categories = {
        "Salary": 1,
        "Part-time Job": 2,
        "Bonus": 3,
        "Other Income": 4
    };

    return categories[category];
}


// ======================================================
// UPDATE INCOME
// ======================================================

const editIncomeForm =
    document.getElementById(
        "editIncomeForm"
    );

editIncomeForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        if (!editingIncomeId) {
            return;
        }

        const incomeData = {
            category_id: Number(
                document.getElementById(
                    "editIncomeCategory"
                ).value
            ),

            amount: Number(
                document.getElementById(
                    "editIncomeAmount"
                ).value
            ),

            description:
                document.getElementById(
                    "editIncomeDescription"
                ).value,

            income_date:
                document.getElementById(
                    "editIncomeDate"
                ).value
        };

        try {
            const response =
                await fetch(
                    `/api/income/${editingIncomeId}`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                incomeData
                            )
                    }
                );

            const data =
                await response.json();

            if (data.success) {
                closeIncomeModal();

                await loadIncome();
                await loadDashboard();
                await loadIncomeExpenseChart();

            } else {
                alert(data.message);
            }

        } catch (error) {
            console.error(error);

            alert(
                "Failed to update income."
            );
        }
    }
);


// ======================================================
// CLOSE INCOME MODAL
// ======================================================

function closeIncomeModal() {
    document.getElementById(
        "editIncomeModal"
    ).style.display = "none";

    editingIncomeId = null;
}


// ======================================================
// DELETE INCOME
// ======================================================

async function deleteIncome(id) {
    const confirmed =
        confirm(
            "Are you sure you want to delete this income?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const response =
            await fetch(
                `/api/income/${id}`,
                {
                    method: "DELETE"
                }
            );

        const data =
            await response.json();

        if (data.success) {
            await loadIncome();
            await loadDashboard();
            await loadIncomeExpenseChart();

        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error(error);

        alert(
            "Failed to delete income."
        );
    }
}


// ======================================================
// NOTIFICATION
// ======================================================

function showNotification(message) {
    const notification =
        document.getElementById(
            "notification"
        );

    notification.textContent =
        message;

    notification.style.display =
        "block";

    setTimeout(() => {
        notification.style.display =
            "none";
    }, 4000);
}


// ======================================================
// CURRENT MONTH NAME
// ======================================================

function getCurrentMonthName() {
    const date = new Date();

    return date.toLocaleString(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    );
}


// ======================================================
// START
// ======================================================

updateMonthTitle();
checkAuth();