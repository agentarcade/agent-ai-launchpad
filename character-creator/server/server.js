// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./routes/chatRoutes.js";
import characterRoutes from "./routes/characterRoutes.js";
import db from "./db/database.js";
import gameAgentRoutes from "./routes/gameAgentRoutes.js";
// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
	origin: [
		'https://app.agentarcade.fun',
		'http://localhost:3000',
		'http://localhost:5173'
	],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true
}));

// Initialize database
await db.initialize();

// Routes
app.use("/chat", chatRoutes);
app.use("/characters", characterRoutes);
app.use("/game-agents", gameAgentRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
	const requiredEnvVars = [
		"AZURE_OPENAI_API_KEY",
		"AZURE_OPENAI_API_VERSION",
		"AZURE_OPENAI_DEPLOYMENT_NAME",
		"AZURE_OPENAI_INSTANCE_NAME",
	];

	const missingEnvVars = requiredEnvVars.filter(
		(varName) => !process.env[varName],
	);

	res.json({
		status: missingEnvVars.length === 0 ? "ok" : "missing_configuration",
		timestamp: new Date().toISOString(),
		database: "connected",
		env: {
			hasAzureKey: !!process.env.AZURE_OPENAI_API_KEY,
			hasApiVersion: !!process.env.AZURE_OPENAI_API_VERSION,
			hasDeploymentName: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
			hasInstanceName: !!process.env.AZURE_OPENAI_INSTANCE_NAME,
		},
		missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
	});
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error("Unhandled error:", err);
	
	// Handle CORS errors
	if (err.name === 'CORSError') {
		return res.status(403).json({
			error: "CORS error",
			message: "Cross-Origin Request blocked",
			details: process.env.NODE_ENV === "development" ? err.message : undefined
		});
	}
	
	// Handle database errors
	if (err.code && err.code.startsWith('SQLITE_')) {
		return res.status(500).json({
			error: "Database error",
			message: "Error accessing the database",
			details: process.env.NODE_ENV === "development" ? err.message : undefined
		});
	}
	
	// Default error response
	res.status(err.status || 500).json({
		error: err.message || "Internal server error",
		details: process.env.NODE_ENV === "development" ? err.stack : undefined,
	});
});

// 404 handler for undefined routes
app.use((req, res) => {
	res.status(404).json({
		error: "Not Found",
		message: `Cannot ${req.method} ${req.url}`
	});
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("Received SIGTERM signal. Starting graceful shutdown...");

	try {
		await db.close();
		console.log("Database connections closed.");

		server.close(() => {
			console.log("Server stopped accepting new connections.");
			process.exit(0);
		});
	} catch (error) {
		console.error("Error during shutdown:", error);
		process.exit(1);
	}
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Health check available at http://localhost:${PORT}/health`);
});

export default app;
