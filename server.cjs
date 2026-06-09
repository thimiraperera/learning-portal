/* Production server for cPanel (Passenger).
   Serves the Vite build in ./dist and falls back to index.html so
   client-side routes (React Router) work on refresh / deep links. */
const express = require("express");
const path = require("path");

const app = express();
const dist = path.join(__dirname, "dist");

app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Learning Portal listening on port " + port));
