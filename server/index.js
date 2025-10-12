// server/index.js
import express from "express";
import cors from "cors";
import adminRoomsRouter from "./Routes/adminRooms.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Route chính
app.use("/api/admin", adminRoomsRouter);

// Phục vụ file tĩnh (HTML)
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
