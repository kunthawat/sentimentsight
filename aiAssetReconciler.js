const winston = require('winston'); // Install winston: npm install winston
const fetch = require('node-fetch'); // Install node-fetch: npm install node-fetch

// Configure the Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Default log level to 'info'
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }), // Log stack traces for errors
        winston.format.splat(), // Enable string interpolation for messages
        winston.format.json() // Output logs in JSON format for structured logging
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // Add colors to console output
                winston.format.printf(
                    info => `${info.timestamp} ${info.level}: ${info.message} ${info.stack ? '\n' + info.stack : ''}`
                )
            )
        }),
        // In a production environment, you might add file transports or other transports:
        // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // new winston.transports.File({ filename: 'logs/combined.log' })
    ],
});

// Load AI service configurations from an external JSON file.
// This assumes aiServiceConfigs.json is located in the 'config' directory,
// relative to where this component file might reside (e.g., if this is in 'services/').
// Example path: ../config/aiServiceConfigs.json.
// The content of config/aiServiceConfigs.json should be a JSON object like:
/*
{
    "openAi": {
        "apiKeyEnv": "OPENAI_API_KEY",
        "endpoint": "https://api.openai.com/v1/models", // Often a general model list endpoint can serve as health check
        "statusEndpoint": "https://api.openai.com/v1/models", // Can be same as endpoint if it's a valid GET target
        "apiKeyFormatRegex": "^sk-" // Example regex for OpenAI API keys
    },
    "googleCloudNLP": {
        "apiKeyEnv": "GOOGLE_CLOUD_NLP_API_KEY",
        "endpoint": "https://language.googleapis.com/v1/documents:analyzeSentiment",
        "apiKeyFormatRegex": "^AIza" // Example regex for Google Cloud API keys (starts with AIza)
    },
    "customInternalSentimentModel": {
        "endpoint": "http://localhost:8000/api/sentiment/health",
        "modelVersionEnv": "SENTIMENT_MODEL_VERSION" // Example for an internal model version check
    }
}
*/
let AI_SERVICE_CONFIGS = {};
try {
    // Adjust path as necessary based on component's actual location relative to the 'config' folder.
    // If aiAssetReconciler.js is directly in the project root, use './config/aiServiceConfigs.json'.
    // If aiAssetReconciler.js is in 'services/' folder, then '../config/aiServiceConfigs.json' is correct.
    AI_SERVICE_CONFIGS = require('../config/aiServiceConfigs.json');
    logger.info('[AI Reconciler] Loaded AI service configurations from config/aiServiceConfigs.json.');
} catch (error) {
    logger.error(`[AI Reconciler] Failed to load AI service configurations from config/aiServiceConfigs.json: ${error.message}. Please ensure the file exists and is correctly formatted. Using default empty config.`);
    // In a critical application, you might want to terminate the process here
    // process.exit(1);
}

/**
 * Validates the presence and format of an AI service API key from environment variables.
 * @param {string} envVarName The name of the environment variable holding the API key.
 * @param {RegExp | null} formatRegex An optional regular expression to validate the API key format (e.g., /^sk-/).
 * @returns {boolean} True if the API key is present, a string, not empty, and matches the formatRegex if provided; false otherwise.
 */
function _validateApiKey(envVarName, formatRegex = null) {
    const apiKey = process.env[envVarName];
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        logger.warn(`[AI Reconciler] Missing or invalid API key for '${envVarName}'. Please ensure it's set in your environment variables.`);
        return false;
    }

    if (formatRegex && !formatRegex.test(apiKey)) {
        logger.warn(`[AI Reconciler] API key for '${envVarName}' does not match expected format.`);
        return false;
    }

    logger.debug(`[AI Reconciler] API key for '${envVarName}' is present and valid.`);
    return true;
}

/**
 * Checks the reachability and basic health of an AI service endpoint by making an actual HTTP GET request.
 * @param {string} serviceName The logical name of the AI service (e.g., 'OpenAI', 'Google Cloud NLP').
 * @param {string} endpoint The URL of the service endpoint to check.
 * @param {number} timeoutMs The timeout for the HTTP request in milliseconds.
 * @returns {Promise<boolean>} A promise that resolves to true if the endpoint is considered reachable and healthy (HTTP 2xx status), false otherwise.
 */
async function _checkServiceEndpointHealth(serviceName, endpoint, timeoutMs = 5000) {
    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
        logger.error(`[AI Reconciler] Invalid endpoint URL provided for '${serviceName}': ${endpoint}`);
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal, // Link abort controller to the fetch request
            // Add any necessary headers for the health check if required (e.g., API key for protected health endpoints)
            // headers: { 'Authorization': `Bearer ${process.env.SOME_API_KEY}` }
        });

        clearTimeout(timeoutId); // Clear timeout if fetch completes within time

        if (!response.ok) {
            logger.error(`[AI Reconciler] '${serviceName}' endpoint '${endpoint}' returned status ${response.status} (${response.statusText}).`);
            try {
                const errorBody = await response.text();
                logger.debug(`[AI Reconciler] Error response body for '${serviceName}': ${errorBody.substring(0, 200)}...`);
            } catch (bodyError) {
                logger.warn(`[AI Reconciler] Could not read error response body for '${serviceName}'.`);
            }
            return false;
        }

        logger.info(`[AI Reconciler] '${serviceName}' endpoint '${endpoint}' is reachable and returned OK status.`);
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.error(`[AI Reconciler] Timeout checking '${serviceName}' endpoint '${endpoint}' after ${timeoutMs}ms.`);
        } else {
            logger.error(`[AI Reconciler] Error checking '${serviceName}' endpoint '${endpoint}': ${error.message}`);
        }
        return false;
    }
}

/**
 * Performs a comprehensive reconciliation of various AI-related assets and configurations for SentimentSight.
 * This includes validating API keys, checking service endpoint health, and logging any discrepancies.
 * @returns {Promise<Object>} A promise that resolves to an object containing the overall health status
 *                            and detailed results for each AI service checked.
 * @property {boolean} allHealthy - True if all checked assets passed their reconciliation, false otherwise.
 * @property {Object} details - An object with detailed results for each AI service.
 */
async function reconcileAssets() {
    logger.info('[AI Reconciler] Starting AI asset reconciliation...');
    const reconciliationResults = {};
    let allAssetsHealthy = true; // Flag to track overall health

    if (Object.keys(AI_SERVICE_CONFIGS).length === 0) {
        logger.warn('[AI Reconciler] No AI service configurations found. Please ensure config/aiServiceConfigs.json is present and correctly populated. Skipping reconciliation.');
        return {
            allHealthy: false,
            details: { message: 'No AI service configurations loaded.' }
        };
    }

    for (const serviceKey in AI_SERVICE_CONFIGS) {
        const config = AI_SERVICE_CONFIGS[serviceKey];
        reconciliationResults[serviceKey] = {}; // Initialize results for the current service

        logger.info(`[AI Reconciler] Checking configuration for service: '${serviceKey}'...`);

        // 1. Validate API Key if configured
        const apiKeyEnv = config.apiKeyEnv;
        if (apiKeyEnv) {
            // Convert apiKeyFormatRegex string from config to a RegExp object if it exists
            const formatRegex = config.apiKeyFormatRegex ? new RegExp(config.apiKeyFormatRegex) : null;
            const isApiKeyValid = _validateApiKey(apiKeyEnv, formatRegex);
            reconciliationResults[serviceKey].apiKeyValid = isApiKeyValid;
            if (!isApiKeyValid) {
                allAssetsHealthy = false;
            }
        } else {
            logger.debug(`[AI Reconciler] No API key environment variable configured for '${serviceKey}'. Skipping API key validation.`);
            reconciliationResults[serviceKey].apiKeyValid = 'N/A (not configured)';
        }

        // 2. Check Primary Service Endpoint Health if configured
        if (config.endpoint) {
            const isEndpointHealthy = await _checkServiceEndpointHealth(serviceKey, config.endpoint);
            reconciliationResults[serviceKey].primaryEndpointHealthy = isEndpointHealthy;
            if (!isEndpointHealthy) {
                allAssetsHealthy = false;
            }
        } else {
            logger.debug(`[AI Reconciler] No primary endpoint configured for '${serviceKey}'. Skipping primary endpoint health check.`);
            reconciliationResults[serviceKey].primaryEndpointHealthy = 'N/A (not configured)';
        }

        // 3. Check Dedicated Status/Health Endpoint if configured and different from primary
        if (config.statusEndpoint && config.statusEndpoint !== config.endpoint) {
            const isStatusEndpointHealthy = await _checkServiceEndpointHealth(`${serviceKey} Status`, config.statusEndpoint);
            reconciliationResults[serviceKey].statusEndpointHealthy = isStatusEndpointHealthy;
            if (!isStatusEndpointHealthy) {
                allAssetsHealthy = false;
            }
        } else if (config.statusEndpoint) {
            logger.debug(`[AI Reconciler] Status endpoint for '${serviceKey}' is same as primary endpoint. Skipping redundant check.`);
            reconciliationResults[serviceKey].statusEndpointHealthy = 'Same as Primary';
        } else {
            logger.debug(`[AI Reconciler] No dedicated status endpoint configured for '${serviceKey}'.`);
            reconciliationResults[serviceKey].statusEndpointHealthy = 'N/A (not configured)';
        }

        // Add more specific reconciliation checks here relevant to SentimentSight,
        // such as checking specific model versions from environment variables, or other service-specific configurations.
        if (config.modelVersionEnv) {
            const modelVersion = process.env[config.modelVersionEnv];
            reconciliationResults[serviceKey].modelVersion = modelVersion || 'Missing';
            if (!modelVersion) {
                logger.warn(`[AI Reconciler] Missing model version for '${serviceKey}' from environment variable '${config.modelVersionEnv}'.`);
                allAssetsHealthy = false;
            } else {
                logger.info(`[AI Reconciler] '${serviceKey}' Model Version: ${modelVersion}`);
            }
        }
    }

    if (allAssetsHealthy) {
        logger.info('[AI Reconciler] All AI assets reconciled successfully and appear healthy.');
    } else {
        logger.error('[AI Reconciler] Issues found during AI asset reconciliation. Please review the detailed results.');
    }

    logger.info('[AI Reconciler] AI asset reconciliation complete. Detailed results:\n' + JSON.stringify(reconciliationResults, null, 2));
    return {
        allHealthy: allAssetsHealthy,
        details: reconciliationResults
    };
}

module.exports = {
    reconcileAssets,
};