import dotenv from 'dotenv';
import dns from 'dns';
import app from './app.js';
import { connectDB } from './config/db.js';

// Configure DNS resolvers to use public DNS servers (Google & Cloudflare)
// This resolves issues where local/ISP DNS servers refuse or fail to query MongoDB SRV records.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
