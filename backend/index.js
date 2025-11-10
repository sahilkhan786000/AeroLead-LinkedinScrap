import express from "express";
import cors from "cors";
import { scrapeForMultipleUsers } from "./scraper.js"
import path from "path";

const app = express();
app.use(cors());
// Serve frontend build files
app.use(express.static(path.join(__dirname, "build")));
app.use(express.json());


// Serve React app for all unknown routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});


app.post("/api/multi-scrape", async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: "Invalid user data" });
    }

    const results = await scrapeForMultipleUsers(users);
    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scraping failed" });
  }
});

app.listen(5000, () => console.log("🚀 Backend running on http://localhost:5000"));
