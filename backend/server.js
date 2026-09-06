const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
    res.json({
        message: "MoneyWise API is running!"
    });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS result");

        res.json({
            success: true,
            message: "MySQL connection successful!",
            data: rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed."
        });
    }
});

app.get("/api/expenses/breakdown/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;
        const year = Number(req.query.year);
        const month = Number(req.query.month);

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
            GROUP BY categories.id, categories.name
            ORDER BY total DESC
        `;

        const [rows] = await pool.query(sql, [
            userId,
            year,
            month
        ]);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error("Expense breakdown error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load expense breakdown."
        });
    }
});
app.listen(PORT, () => {
    console.log(`MoneyWise server running on http://localhost:${PORT}`);
});
app.get("/api/income/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;
        const year = Number(req.query.year);
        const month = Number(req.query.month);

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

        const params = [userId];

        // Filter by selected month
        if (year && month) {

            sql += `
                AND YEAR(income.income_date) = ?
                AND MONTH(income.income_date) = ?
            `;

            params.push(year, month);
        }

        sql += `
            ORDER BY income.income_date DESC,
                     income.id DESC
        `;

        const [rows] = await pool.query(sql, params);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error("Income history error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load income."
        });
    }
});
app.post("/api/income", async (req, res) => {
    try {
        const {
            user_id,
            category_id,
            amount,
            description,
            income_date
        } = req.body;

        const sql = `
            INSERT INTO income
            (user_id, category_id, amount, description, income_date)
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(sql, [
            user_id,
            category_id,
            amount,
            description,
            income_date
        ]);

        res.status(201).json({
            success: true,
            message: "Income added successfully!",
            income_id: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to add income."
        });
    }
});
app.post("/api/expenses", async (req, res) => {

    try {

        const {
            user_id,
            category_id,
            amount,
            description,
            expense_date
        } = req.body;

        const sql = `
            INSERT INTO expenses
            (user_id, category_id, amount, description, expense_date)
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(sql, [
            user_id,
            category_id,
            amount,
            description,
            expense_date
        ]);

        res.status(201).json({
            success: true,
            message: "Expense added successfully!",
            expense_id: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to add expense."
        });
    }
});
app.get("/api/dashboard/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;

        const year = Number(req.query.year);
        const month = Number(req.query.month);

        if (!year || !month) {

            return res.status(400).json({
                success: false,
                message: "Year and month are required."
            });

        }

        // Monthly Income
        const [incomeRows] = await pool.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total_income
            FROM income
            WHERE user_id = ?
            AND YEAR(income_date) = ?
            AND MONTH(income_date) = ?
            `,
            [userId, year, month]
        );

        // Monthly Expenses
        const [expenseRows] = await pool.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total_expenses
            FROM expenses
            WHERE user_id = ?
            AND YEAR(expense_date) = ?
            AND MONTH(expense_date) = ?
            `,
            [userId, year, month]
        );

        const totalIncome =
            Number(incomeRows[0].total_income);

        const totalExpenses =
            Number(expenseRows[0].total_expenses);

        const remaining =
            totalIncome - totalExpenses;

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to load monthly dashboard."
        });

    }
});
app.get("/api/expenses/:userId", async (req, res) => {

    try {

        const userId = req.params.userId;
        const year = Number(req.query.year);
        const month = Number(req.query.month);

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

        const params = [userId];

        if (year && month) {

            sql += `
                AND YEAR(expenses.expense_date) = ?
                AND MONTH(expenses.expense_date) = ?
            `;

            params.push(year, month);
        }

        sql += `
            ORDER BY expenses.expense_date DESC,
                     expenses.id DESC
        `;

        const [rows] = await pool.query(sql, params);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error("Expense history error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load expenses."
        });
    }
});
app.delete("/api/expenses/:id", async (req, res) => {

    try {

        const expenseId = req.params.id;

        const [result] = await pool.query(
            "DELETE FROM expenses WHERE id = ?",
            [expenseId]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Expense not found."
            });
        }

        res.json({
            success: true,
            message: "Expense deleted successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to delete expense."
        });
    }
});
app.put("/api/expenses/:id", async (req, res) => {

    try {

        const expenseId = req.params.id;

        const {
            category_id,
            amount,
            description,
            expense_date
        } = req.body;

        const sql = `
            UPDATE expenses
            SET
                category_id = ?,
                amount = ?,
                description = ?,
                expense_date = ?
            WHERE id = ?
        `;

        const [result] = await pool.query(sql, [
            category_id,
            amount,
            description,
            expense_date,
            expenseId
        ]);

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update expense."
        });
    }
});
app.put("/api/income/:id", async (req, res) => {

    try {

        const incomeId =
            req.params.id;

        const {
            category_id,
            amount,
            description,
            income_date
        } = req.body;

        const sql = `
            UPDATE income
            SET
                category_id = ?,
                amount = ?,
                description = ?,
                income_date = ?
            WHERE id = ?
        `;

        const [result] =
            await pool.query(sql, [

                category_id,
                amount,
                description,
                income_date,
                incomeId

            ]);

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update income."
        });

    }
});
app.delete("/api/income/:id", async (req, res) => {

    try {

        const incomeId =
            req.params.id;

        const [result] =
            await pool.query(
                "DELETE FROM income WHERE id = ?",
                [incomeId]
            );

        if (result.affectedRows === 0) {

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to delete income."
        });

    }
});