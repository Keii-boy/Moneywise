const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");

const bcrypt = require("bcrypt");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;


// ===============================
// Middleware
// ===============================

app.use(cors());

app.use(express.json());


// ===============================
// Session Store
// ===============================

const sessionStore = new MySQLStore({}, pool);

app.use(
    session({
        key: "moneywise_session",

        secret: process.env.SESSION_SECRET,

        store: sessionStore,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            // localhost မှာ HTTP သုံးနေလို့ false
            // production HTTPS အတွက် နောက်မှပြောင်းမယ်
            secure: process.env.NODE_ENV === "production",

            sameSite: "lax",

            // 24 hours
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


// ===============================
// Static Frontend
// ===============================

app.use(
    express.static(
        path.join(__dirname, "../frontend")
    )
);


// ===============================
// Authentication Middleware
// ===============================

function requireAuth(req, res, next) {

    if (!req.session.userId) {

        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });

    }

    next();
}


// ===============================
// Root
// ===============================

app.get("/", (req, res) => {

    res.json({
        message: "MoneyWise API is running!"
    });

});


// ===============================
// TEST DATABASE
// ===============================

app.get("/api/test-db", async (req, res) => {

    try {

        const [rows] = await pool.query(
            "SELECT 1 AS result"
        );

        res.json({
            success: true,
            message: "MySQL connection successful!",
            data: rows
        });

    } catch (error) {

        console.error("Database test error:", error);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed."
        });

    }

});


// ======================================================
// REGISTER
// ======================================================

app.post("/api/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        // Required fields
        if (!name || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });

        }


        // Check duplicate email
        const [existingUsers] = await pool.query(

            "SELECT id FROM users WHERE email = ?",

            [email]

        );


        if (existingUsers.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Email is already registered."
            });

        }


        // Hash password
        const hashedPassword =
            await bcrypt.hash(password, 12);


        // Insert user
        const [result] = await pool.query(

            `
            INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)
            `,

            [
                name,
                email,
                hashedPassword
            ]

        );


        res.status(201).json({

            success: true,

            message: "User registered successfully.",

            userId: result.insertId

        });


    } catch (error) {

        console.error(
            "Register error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to register user."
        });

    }

});


// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });

        }


        // Find user
        const [users] = await pool.query(

            `
            SELECT
                id,
                name,
                email,
                password
            FROM users
            WHERE email = ?
            `,

            [email]

        );


        if (users.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        }


        const user = users[0];


        // Compare password
        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        }


        // Save logged-in user ID to session
        req.session.userId = user.id;


        res.json({

            success: true,

            message: "Login successful.",

            user: {

                id: user.id,

                name: user.name,

                email: user.email

            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to login."
        });

    }

});


// ======================================================
// CURRENT LOGGED-IN USER
// ======================================================

app.get("/api/me", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Not authenticated."
            });

        }


        const [users] = await pool.query(

            `
            SELECT
                id,
                name,
                email
            FROM users
            WHERE id = ?
            `,

            [req.session.userId]

        );


        if (users.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        }


        res.json({

            success: true,

            user: users[0]

        });


    } catch (error) {

        console.error(
            "Get current user error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to get current user."
        });

    }

});


// ======================================================
// LOGOUT
// ======================================================

app.post("/api/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to logout."
            });

        }


        res.clearCookie(
            "moneywise_session"
        );


        res.json({
            success: true,
            message: "Logout successful."
        });

    });

});


// ======================================================
// EXPENSE BREAKDOWN
// ======================================================

app.get(
    "/api/expenses/breakdown/:userId",
    requireAuth,
    async (req, res) => {

        try {

            // URL userId ကိုမယုံဘူး
            const userId =
                req.session.userId;

            const year =
                Number(req.query.year);

            const month =
                Number(req.query.month);


            if (!year || !month) {

                return res.status(400).json({
                    success: false,
                    message: "Year and month are required."
                });

            }


            const sql = `

                SELECT

                    categories.name AS category,

                    SUM(expenses.amount) AS total

                FROM expenses

                INNER JOIN categories
                    ON expenses.category_id = categories.id

                WHERE expenses.user_id = ?

                AND YEAR(expenses.expense_date) = ?

                AND MONTH(expenses.expense_date) = ?

                GROUP BY
                    categories.id,
                    categories.name

                ORDER BY total DESC

            `;


            const [rows] =
                await pool.query(
                    sql,
                    [
                        userId,
                        year,
                        month
                    ]
                );


            res.json({
                success: true,
                data: rows
            });


        } catch (error) {

            console.error(
                "Expense breakdown error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to load expense breakdown."
            });

        }

    }
);


// ======================================================
// INCOME HISTORY
// ======================================================

app.get(
    "/api/income/:userId",
    requireAuth,
    async (req, res) => {

        try {

            const userId =
                req.session.userId;

            const year =
                Number(req.query.year);

            const month =
                Number(req.query.month);


            let sql = `

                SELECT

                    income.id,

                    income.amount,

                    income.description,

                    income.income_date,

                    categories.name AS category

                FROM income

                INNER JOIN categories
                    ON income.category_id = categories.id

                WHERE income.user_id = ?

            `;


            const params = [
                userId
            ];


            if (year && month) {

                sql += `

                    AND YEAR(income.income_date) = ?

                    AND MONTH(income.income_date) = ?

                `;

                params.push(
                    year,
                    month
                );

            }


            sql += `

                ORDER BY
                    income.income_date DESC,
                    income.id DESC

            `;


            const [rows] =
                await pool.query(
                    sql,
                    params
                );


            res.json({
                success: true,
                data: rows
            });


        } catch (error) {

            console.error(
                "Income history error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to load income."
            });

        }

    }
);


// ======================================================
// ADD INCOME
// ======================================================

app.post(
    "/api/income",
    requireAuth,
    async (req, res) => {

        try {

            const {

                category_id,

                amount,

                description,

                income_date

            } = req.body;


            // Logged-in user only
            const user_id =
                req.session.userId;


            if (
                !category_id ||
                !amount ||
                !income_date
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Category, amount and date are required."
                });

            }


            const sql = `

                INSERT INTO income

                (
                    user_id,
                    category_id,
                    amount,
                    description,
                    income_date
                )

                VALUES (?, ?, ?, ?, ?)

            `;


            const [result] =
                await pool.query(

                    sql,

                    [
                        user_id,
                        category_id,
                        amount,
                        description,
                        income_date
                    ]

                );


            res.status(201).json({

                success: true,

                message: "Income added successfully!",

                income_id:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "Add income error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to add income."
            });

        }

    }
);


// ======================================================
// ADD EXPENSE
// ======================================================

app.post(
    "/api/expenses",
    requireAuth,
    async (req, res) => {

        try {

            const {

                category_id,

                amount,

                description,

                expense_date

            } = req.body;


            const user_id =
                req.session.userId;


            if (
                !category_id ||
                !amount ||
                !expense_date
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Category, amount and date are required."
                });

            }


            const sql = `

                INSERT INTO expenses

                (
                    user_id,
                    category_id,
                    amount,
                    description,
                    expense_date
                )

                VALUES (?, ?, ?, ?, ?)

            `;


            const [result] =
                await pool.query(

                    sql,

                    [
                        user_id,
                        category_id,
                        amount,
                        description,
                        expense_date
                    ]

                );


            res.status(201).json({

                success: true,

                message: "Expense added successfully!",

                expense_id:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "Add expense error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to add expense."
            });

        }

    }
);


// ======================================================
// DASHBOARD
// ======================================================

app.get(
    "/api/dashboard/:userId",
    requireAuth,
    async (req, res) => {

        try {

            const userId =
                req.session.userId;

            const year =
                Number(req.query.year);

            const month =
                Number(req.query.month);


            if (!year || !month) {

                return res.status(400).json({
                    success: false,
                    message: "Year and month are required."
                });

            }


            // Monthly income
            const [incomeRows] =
                await pool.query(

                    `

                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS total_income

                    FROM income

                    WHERE user_id = ?

                    AND YEAR(income_date) = ?

                    AND MONTH(income_date) = ?

                    `,

                    [
                        userId,
                        year,
                        month
                    ]

                );


            // Monthly expenses
            const [expenseRows] =
                await pool.query(

                    `

                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS total_expenses

                    FROM expenses

                    WHERE user_id = ?

                    AND YEAR(expense_date) = ?

                    AND MONTH(expense_date) = ?

                    `,

                    [
                        userId,
                        year,
                        month
                    ]

                );


            const totalIncome =
                Number(
                    incomeRows[0]
                        .total_income
                );


            const totalExpenses =
                Number(
                    expenseRows[0]
                        .total_expenses
                );


            const remaining =
                totalIncome -
                totalExpenses;


            res.json({

                success: true,

                data: {

                    year,

                    month,

                    totalIncome,

                    totalExpenses,

                    remaining

                }

            });


        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to load monthly dashboard."
            });

        }

    }
);


// ======================================================
// EXPENSE HISTORY
// ======================================================

app.get(
    "/api/expenses/:userId",
    requireAuth,
    async (req, res) => {

        try {

            const userId =
                req.session.userId;

            const year =
                Number(req.query.year);

            const month =
                Number(req.query.month);


            let sql = `

                SELECT

                    expenses.id,

                    expenses.amount,

                    expenses.description,

                    expenses.expense_date,

                    categories.name AS category

                FROM expenses

                INNER JOIN categories
                    ON expenses.category_id = categories.id

                WHERE expenses.user_id = ?

            `;


            const params = [
                userId
            ];


            if (year && month) {

                sql += `

                    AND YEAR(expenses.expense_date) = ?

                    AND MONTH(expenses.expense_date) = ?

                `;

                params.push(
                    year,
                    month
                );

            }


            sql += `

                ORDER BY
                    expenses.expense_date DESC,
                    expenses.id DESC

            `;


            const [rows] =
                await pool.query(
                    sql,
                    params
                );


            res.json({
                success: true,
                data: rows
            });


        } catch (error) {

            console.error(
                "Expense history error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to load expenses."
            });

        }

    }
);


// ======================================================
// UPDATE EXPENSE
// ======================================================

// ======================================================
// UPDATE EXPENSE
// ======================================================

app.put(
    "/api/expenses/:id",
    requireAuth,
    async (req, res) => {

        try {

            // URL ထဲက expense ID
            const expenseId = req.params.id;

            // Login ဝင်ထားတဲ့ user ID
            const userId = req.session.userId;


            const {
                category_id,
                amount,
                description,
                expense_date
            } = req.body;


            // Basic validation
            if (
                !category_id ||
                !amount ||
                !expense_date
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Category, amount and date are required."
                });
            }


            // Update only if this expense belongs to logged-in user
            const sql = `

                UPDATE expenses

                SET
                    category_id = ?,
                    amount = ?,
                    description = ?,
                    expense_date = ?

                WHERE id = ?

                AND user_id = ?

            `;


            const [result] = await pool.query(
                sql,
                [
                    category_id,
                    amount,
                    description,
                    expense_date,
                    expenseId,
                    userId
                ]
            );


            // Either record doesn't exist
            // or it belongs to another user
            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Expense not found."
                });

            }


            res.json({
                success: true,
                message: "Expense updated successfully."
            });


        } catch (error) {

            console.error(
                "Update expense error:",
                error
            );


            res.status(500).json({
                success: false,
                message: "Failed to update expense."
            });

        }

    }
);


// ======================================================
// DELETE EXPENSE
// ======================================================

// ======================================================
// DELETE EXPENSE
// ======================================================

app.delete(
    "/api/expenses/:id",
    requireAuth,
    async (req, res) => {

        try {

            // URL ထဲက expense ID
            const expenseId = req.params.id;

            // Login ဝင်ထားတဲ့ user ID
            const userId = req.session.userId;


            // Expense ကို delete လုပ်မယ်
            // ဒါပေမယ့် logged-in user ပိုင်တဲ့ record ဖြစ်မှပဲ delete လုပ်မယ်
            const [result] = await pool.query(

                `
                DELETE FROM expenses

                WHERE id = ?

                AND user_id = ?
                `,

                [
                    expenseId,
                    userId
                ]

            );


            // Record မရှိတာဖြစ်နိုင်သလို
            // တခြား user ပိုင်တဲ့ record ဖြစ်နေတာလည်းဖြစ်နိုင်တယ်
            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Expense not found."
                });

            }


            // Delete အောင်မြင်
            res.json({
                success: true,
                message: "Expense deleted successfully."
            });


        } catch (error) {

            console.error(
                "Delete expense error:",
                error
            );


            res.status(500).json({
                success: false,
                message: "Failed to delete expense."
            });

        }

    }
);


// ======================================================
// UPDATE INCOME
// ======================================================

// ======================================================
// UPDATE INCOME
// ======================================================

app.put(
    "/api/income/:id",
    requireAuth,
    async (req, res) => {

        try {

            const incomeId = req.params.id;
            const userId = req.session.userId;

            const {
                category_id,
                amount,
                description,
                income_date
            } = req.body;

            if (
                !category_id ||
                !amount ||
                !income_date
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Category, amount and date are required."
                });
            }

            const sql = `
                UPDATE income

                SET
                    category_id = ?,
                    amount = ?,
                    description = ?,
                    income_date = ?

                WHERE id = ?
                AND user_id = ?
            `;

            const [result] = await pool.query(
                sql,
                [
                    category_id,
                    amount,
                    description,
                    income_date,
                    incomeId,
                    userId
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Income not found."
                });
            }

            res.json({
                success: true,
                message: "Income updated successfully."
            });

        } catch (error) {

            console.error(
                "Update income error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to update income."
            });

        }

    }
);


// ======================================================
// DELETE INCOME
// ======================================================

app.delete(
    "/api/income/:id",
    requireAuth,
    async (req, res) => {

        try {

            const incomeId =
                req.params.id;

            const userId =
                req.session.userId;


            const [result] =
                await pool.query(

                    `

                    DELETE FROM income

                    WHERE id = ?

                    AND user_id = ?

                    `,

                    [
                        incomeId,
                        userId
                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message: "Income not found."
                });

            }


            res.json({
                success: true,
                message: "Income deleted successfully."
            });


        } catch (error) {

            console.error(
                "Delete income error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to delete income."
            });

        }

    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

    console.log(
        `MoneyWise server running on http://localhost:${PORT}`
    );

});