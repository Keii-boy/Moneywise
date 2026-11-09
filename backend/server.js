require("dotenv").config();

const express = require("express");

const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

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



// Requests must originate from our own frontend; do not enable wildcard CORS.
app.use((req, res, next) => {
    if (!req.path.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("Origin");
    if (origin) {
        const allowed = new Set([process.env.APP_BASE_URL || "http://localhost:3000"]);
        if (!allowed.has(origin)) return res.status(403).json({success:false,message:"Cross-origin request blocked."});
    }
    next();
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false,
    message: { success:false, message:"Too many attempts. Please try later." } });
app.use(["/api/register", "/api/login", "/api/auth", "/api/account/password"], authLimiter);




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



// ======================================================
// VERIFIED REGISTRATION + LOGIN
// ======================================================

app.post("/api/register", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;
    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || Buffer.byteLength(password,"utf8") > 256) {
        return res.status(400).json({ success:false, message:"Valid name, email and password of at least 12 characters required." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const [result] = await pool.query(
            "INSERT INTO users (name,email,password,email_verified) VALUES (?,?,?,FALSE)",
            [name,email,hashedPassword]
        );
        try { await issueEmailToken(result.insertId, email, "verify_email"); }
        catch(error) { console.error("Verification delivery error:",error); }
        return res.status(201).json({ success:true,
            message:"Account created. Check your email to verify it. If no email arrives, use Resend verification." });
    } catch(error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({success:false,message:"Email already registered."});
        console.error("Registration error:",error);
        return res.status(500).json({success:false,message:"Registration failed."});
    }
});

app.post("/api/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== "string") return res.status(400).json({success:false,message:"Email and password required."});
    try {
        const [users] = await pool.query(
            "SELECT id,name,email,password,email_verified,google_sub FROM users WHERE email = ?",[email]);
        const user = users[0];
        if (!user || !(await bcrypt.compare(password,user.password)))
            return res.status(401).json({success:false,message:"Invalid email or password."});
        if (!user.email_verified)
            return res.status(403).json({success:false,message:"Please verify your email before logging in."});
        await establishSession(req,user.id);
        return res.json({success:true,user:{id:user.id,name:user.name,email:user.email}});
    } catch(error) {
        console.error("Login error:",error);
        return res.status(500).json({success:false,message:"Login failed."});
    }
});

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







// ==============================

// GET CURRENT USER WALLET

// ==============================



app.get ("/api/wallet", requireAuth, async (req, res) => {

    try {

        const userId = req.session.userId;

        const [rows] = await pool.query('SELECT initial_balance, balance_date FROM wallets WHERE user_id = ?', [userId]);

        if (rows.length === 0) {

            return res.json({

                success: true,

                walletExists: false,

                message: "Wallet not found."

            });

        }

        res.json({

            success: true,

            walletExists: true,

            wallet: rows[0]

        });

    } catch (error) {

        console.error("Get wallet error:", error);

        res.status(500).json({

            success: false,

            message: "Failed to load wallet."

        });

    }

});



// ==============================

// CREATE WALLET / SET STARTING BALANCE

// ==============================



app.post("/api/wallet", requireAuth, async (req, res) => {

    try {

        const userId = req.session.userId;

        const { initial_balance, balance_date } = req.body;

        // Validate amount

        const amount = Number (initial_balance);

        if(

            initial_balance === undefined ||

            initial_balance === null ||

            initial_balance === "" ||

            !Number.isFinite(amount) ||

            amount < 0 ||

            amount > 99999999.99||

            !/^\d+(\.\d{1,2})?$/.test(String(initial_balance))

        ) {

            return res.status(400).json({

                success: false,

                message: "Invalid initial balance."

            });

        }



        //Check existing wallet

        const [existingWallet] = await pool.query('SELECT id FROM wallets WHERE user_id = ?', [userId]);

        if (existingWallet.length > 0) {

            return res.status(400).json({

                success: false,

                message: "Wallet already exists."

            });

        }



        // Create wallet with transcation cutoffs&#x20;

        const connection = await pool.getConnection();

        try {

            await connection.beginTransaction();



            // Lock this user's row while initializing wallet

            await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);



            //Check again inside the transaction

            const [walletRows] = await connection.query('SELECT id FROM wallets WHERE user_id = ?', [userId]);

            if (walletRows.length > 0) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message: "Wallet already exists."

                });

            }



             const [incomeRows] = await connection.query(

        `SELECT COALESCE(MAX(id), 0) AS cutoff

         FROM income WHERE user_id = ?`,

        [userId]

    );



    const [expenseRows] = await connection.query(

        `SELECT COALESCE(MAX(id), 0) AS cutoff

         FROM expenses WHERE user_id = ?`,

        [userId]

    );



    await connection.query(

        `INSERT INTO wallets

         (user_id, initial_balance, balance_date,

          income_cutoff_id, expense_cutoff_id)

         VALUES (?, ?, CURDATE(), ?, ?)`,

        [

            userId,

            amount,

            incomeRows[0].cutoff,

            expenseRows[0].cutoff

        ]

    );



    await connection.commit();



} catch (error) {

    await connection.rollback();

    throw error;

} finally {

    connection.release();

}





        res.status(201).json({

            success: true,

            message: "Wallet created successfully."

        });



    } catch (error) {



        console.error("Create wallet error:", error);



        if (error.code === "ER_DUP_ENTRY") {



            return res.status(400).json({

                success: false,

                message: "Wallet already exists."

            });

        }



        res.status(500).json({

            success: false,

            message: "Failed to create wallet."

        });

    }

});



// ======================================

// GET AVAILABLE BALANCE

// ======================================



app.get("/api/wallet/balance", requireAuth, async (req, res) => {

    try {

        const userId = req.session.userId;



        const [walletRows] = await pool.query(

            `SELECT initial_balance,

                    income_cutoff_id,

                    expense_cutoff_id

             FROM wallets

             WHERE user_id = ?`,

            [userId]

        );



        if (walletRows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Wallet not found."

            });

        }



        const wallet = walletRows[0];



        // Income added after wallet creation

        const [incomeRows] = await pool.query(

            `SELECT COALESCE(SUM(amount), 0) AS total

             FROM income

             WHERE user_id = ?

               AND id > ?`,

            [userId, wallet.income_cutoff_id]

        );



        // Expenses added after wallet creation

        const [expenseRows] = await pool.query(

            `SELECT COALESCE(SUM(amount), 0) AS total

             FROM expenses

             WHERE user_id = ?

               AND id > ?`,

            [userId, wallet.expense_cutoff_id]

        );



        const initialBalance = Number(wallet.initial_balance);

        const totalIncome = Number(incomeRows[0].total);

        const totalExpenses = Number(expenseRows[0].total);



        const availableBalance =

            initialBalance + totalIncome - totalExpenses;



        res.json({

            success: true,

            initialBalance,

            totalIncome,

            totalExpenses,

            availableBalance: Number(availableBalance.toFixed(2))

        });



    } catch (error) {

        console.error("Get balance error:", error);



        res.status(500).json({

            success: false,

            message: "Failed to calculate balance."

        });

    }

});



// ==========================================

// PROFILE & SETTINGS API

// ==========================================



// GET PROFILE

app.get("/api/profile", requireAuth, async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT id, name, email, email_verified

             FROM users

             WHERE id = ?`,

            [req.session.userId]

        );



        if (!rows.length) {

            return res.status(404).json({

                success: false,

                message: "User not found."

            });

        }



        res.json({

            success: true,

            user: rows[0]

        });



    } catch (error) {

        console.error("Profile error:", error);



        res.status(500).json({

            success: false,

            message: "Failed to load profile."

        });

    }

});





// UPDATE PROFILE

app.put("/api/profile", requireAuth, async (req, res) => {

    try {

        const name = String(req.body.name || "").trim();



        if (name.length < 2 || name.length > 100) {

            return res.status(400).json({

                success: false,

                message: "Name must contain 2–100 characters."

            });

        }



        await pool.query(

            "UPDATE users SET name = ? WHERE id = ?",

            [name, req.session.userId]

        );



        res.json({

            success: true,

            message: "Profile updated successfully.",

            user: {

                id: req.session.userId,

                name

            }

        });



    } catch (error) {

        console.error("Update profile error:", error);



        res.status(500).json({

            success: false,

            message: "Failed to update profile."

        });

    }

});





// GET SETTINGS

app.get("/api/preferences", requireAuth, async (req, res) => {

    try {

        await pool.query(

            `INSERT IGNORE INTO user_preferences (user_id)

             VALUES (?)`,

            [req.session.userId]

        );



        const [rows] = await pool.query(

            `SELECT theme, language, notifications_enabled

             FROM user_preferences

             WHERE user_id = ?`,

            [req.session.userId]

        );



        res.json({

            success: true,

            preferences: rows[0]

        });



    } catch (error) {

        console.error("Preferences error:", error);



        res.status(500).json({

            success: false,

            message: "Failed to load preferences."

        });

    }

});





// UPDATE SETTINGS

app.put("/api/preferences", requireAuth, async (req, res) => {

    try {

        const {

            theme,

            language,

            notifications_enabled

        } = req.body;



        if (!["light", "dark"].includes(theme)) {

            return res.status(400).json({

                success: false,

                message: "Invalid theme."

            });

        }



        if (!["en", "ja", "my", "zh"].includes(language)) {

            return res.status(400).json({

                success: false,

                message: "Invalid language."

            });

        }



        if (typeof notifications_enabled !== "boolean") {

            return res.status(400).json({

                success: false,

                message: "Invalid notification preference."

            });

        }



        await pool.query(

            `INSERT INTO user_preferences

             (user_id, theme, language, notifications_enabled)

             VALUES (?, ?, ?, ?)

             ON DUPLICATE KEY UPDATE

                theme = ?,

                language = ?,

                notifications_enabled = ?`,

            [

                req.session.userId,

                theme,

                language,

                notifications_enabled,

                theme,

                language,

                notifications_enabled

            ]

        );



        res.json({

            success: true,

            message: "Preferences saved."

        });



    } catch (error) {

        console.error("Update preferences error:", error);



        res.status(500).json({

            success: false,

            message: "Failed to save preferences."

        });

    }

});



//======================================================

// START SERVER

// ======================================================




// ======================================================
// AUTH UTILITIES & ACCOUNT ROUTES
// ======================================================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}
});

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
function emailReady() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}
async function establishSession(req,userId) {
    await new Promise((resolve,reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.userId = userId;
    await new Promise((resolve,reject) => req.session.save(err => err ? reject(err) : resolve()));
}
async function issueEmailToken(userId,email,purpose) {
    if (!emailReady()) throw new Error("SMTP is not configured");
    const token = crypto.randomBytes(32).toString("hex");
    const minutes = purpose === "verify_email" ? 30 : 20;
    const base = process.env.APP_BASE_URL || "http://localhost:3000";
    const path = purpose === "verify_email" ? "verify_token" : "reset_token";
    const url = `${base}/?${path}=${encodeURIComponent(token)}`;
    await pool.query("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?",[userId,purpose]);
    await pool.query(
      `INSERT INTO auth_tokens (user_id,token_hash,purpose,expires_at)
       VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE))`,
      [userId,hashToken(token),purpose,minutes]
    );
    await mailer.sendMail({from:process.env.SMTP_FROM,to:email,
      subject:purpose === "verify_email" ? "Verify your MoneyWise email" : "Reset your MoneyWise password",
      text:`Open this link within ${minutes} minutes:\n${url}\n\nIf you did not request this, ignore the message.`});
}

app.get("/api/auth/config", (_req,res) => res.json({success:true,googleClientId:process.env.GOOGLE_CLIENT_ID || null}));

app.post("/api/auth/resend-verification", async (req,res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    try {
        const [rows] = await pool.query("SELECT id,email_verified FROM users WHERE email = ?",[email]);
        if (rows.length && !rows[0].email_verified) {
            try { await issueEmailToken(rows[0].id,email,"verify_email"); }
            catch(error) { console.error("Resend verification error:",error); }
        }
        res.json({success:true,message:"If this account needs verification, an email has been requested."});
    } catch(error) {
        console.error("Resend verification DB error:",error);
        res.status(500).json({success:false,message:"Request failed."});
    }
});

app.post("/api/auth/verify-email", async (req,res) => {
    const token = req.body?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return res.status(400).json({success:false,message:"Invalid token."});
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT id,user_id FROM auth_tokens WHERE token_hash=? AND purpose='verify_email'
             AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,[hashToken(token)]);
        if (!rows.length) {await conn.rollback();return res.status(400).json({success:false,message:"Link expired or invalid."});}
        await conn.query("UPDATE users SET email_verified=TRUE WHERE id=?",[rows[0].user_id]);
        await conn.query("DELETE FROM auth_tokens WHERE id=?",[rows[0].id]);
        await conn.commit();
        res.json({success:true,message:"Email verified. You can now sign in."});
    } catch(error) {
        await conn.rollback();console.error("Verify email error:",error);
        res.status(500).json({success:false,message:"Verification failed."});
    } finally {conn.release();}
});

app.post("/api/auth/forgot-password", async (req,res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    try {
        const [users] = await pool.query("SELECT id FROM users WHERE email = ?",[email]);
        if (users.length) {
            try {await issueEmailToken(users[0].id,email,"reset_password");}
            catch(error) {console.error("Reset delivery error:",error);}
        }
        res.json({success:true,message:"If the address is registered, a reset link has been requested."});
    } catch(error) {
        console.error("Password reset request error:",error);
        res.status(500).json({success:false,message:"Request failed."});
    }
});

app.post("/api/auth/reset-password", async (req,res) => {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
        typeof password !== "string" || password.length < 12 || Buffer.byteLength(password,"utf8") > 256)
        return res.status(400).json({success:false,message:"Invalid token or password (minimum 12 characters)."});
    const hashed = await bcrypt.hash(password,12);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT id,user_id FROM auth_tokens WHERE token_hash=? AND purpose='reset_password'
             AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,[hashToken(token)]);
        if (!rows.length) {await conn.rollback();return res.status(400).json({success:false,message:"Link expired or invalid."});}
        await conn.query("UPDATE users SET password=? WHERE id=?",[hashed,rows[0].user_id]);
        await conn.query("DELETE FROM auth_tokens WHERE user_id=? AND purpose='reset_password'",[rows[0].user_id]);
        await conn.commit();
        res.json({success:true,message:"Password updated. Please sign in."});
    } catch(error) {
        await conn.rollback();console.error("Reset password error:",error);
        res.status(500).json({success:false,message:"Password reset failed."});
    } finally {conn.release();}
});

app.post("/api/account/password", requireAuth, async (req,res) => {
    const current = req.body?.currentPassword;
    const next = req.body?.newPassword;
    if (typeof current !== "string" || typeof next !== "string" || next.length < 12 || Buffer.byteLength(next,"utf8")>256)
        return res.status(400).json({success:false,message:"Enter current password and a new password of at least 12 characters."});
    try {
        const [users] = await pool.query("SELECT password FROM users WHERE id=?",[req.session.userId]);
        if (!users.length || !(await bcrypt.compare(current,users[0].password)))
            return res.status(403).json({success:false,message:"Current password incorrect."});
        await pool.query("UPDATE users SET password=? WHERE id=?",[await bcrypt.hash(next,12),req.session.userId]);
        res.json({success:true,message:"Password changed."});
    } catch(error) {
        console.error("Change password error:",error);
        res.status(500).json({success:false,message:"Password change failed."});
    }
});

app.post("/api/auth/google", async (req,res) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({success:false,message:"Google login not configured."});
    const credential = req.body?.credential;
    if (typeof credential !== "string" || credential.length > 10000)
        return res.status(400).json({success:false,message:"Invalid Google credential."});
    try {
        const ticket = await googleClient.verifyIdToken({idToken:credential,audience:process.env.GOOGLE_CLIENT_ID});
        const profile = ticket.getPayload();
        if (!profile?.sub || !profile?.email || profile.email_verified !== true)
            return res.status(401).json({success:false,message:"Google identity not verified."});
        const email = profile.email.toLowerCase();
        const [linked] = await pool.query("SELECT id,name,email FROM users WHERE google_sub=?",[profile.sub]);
        let user = linked[0];
        if (!user) {
            const [sameEmail] = await pool.query("SELECT id FROM users WHERE email=?",[email]);
            if (sameEmail.length) return res.status(409).json({success:false,
                message:"An account already uses this email. Sign in with its existing method; automatic linking is disabled."});
            const hash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"),12);
            const [created] = await pool.query(
                "INSERT INTO users (name,email,password,email_verified,google_sub) VALUES (?,?,?,TRUE,?)",
                [String(profile.name || "Google User").slice(0,100),email,hash,profile.sub]);
            user = {id:created.insertId,name:profile.name || "Google User",email};
        }
        await establishSession(req,user.id);
        res.json({success:true,user});
    } catch(error) {
        console.error("Google sign-in error:",error);
        res.status(401).json({success:false,message:"Google sign-in failed."});
    }
});

app.listen(PORT, () => {



    console.log(

        `MoneyWise server running on http\://localhost:${PORT}`

    );



});