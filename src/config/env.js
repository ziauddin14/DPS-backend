import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REQUIRED_ENV_VARS = ['PORT', 'MONGODB_URI', 'GEMINI_API_KEY'];

/**
 * Validates that all required environment variables are present and not empty.
 * If validation fails, logs a clear message and stops the process.
 */
export const validateEnv = () => {
  const missing = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('==================================================');
    console.error('FATAL SYSTEM STARTUP ERROR: Missing Configuration');
    console.error('--------------------------------------------------');
    console.error('The following required environment variable(s) are missing:');
    missing.forEach((v) => console.error(`  - ${v}`));
    console.error('\nPlease check your .env file or configuration settings.');
    console.error('==================================================');
    process.exit(1);
  }
};
