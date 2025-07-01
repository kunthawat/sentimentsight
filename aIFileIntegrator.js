const fs = require('fs').promises;

/**
 * @module aIFileIntegrator
 * @description Integrates file reading capabilities specifically for AI processing
 *              (e.g., preparing text content for sentiment analysis).
 */

/**
 * Reads the content of a specified text file.
 * @param {string} filePath - The absolute or relative path to the text file.
 * @returns {Promise<string>} A promise that resolves with the content of the file as a string.
 * @throws {Error} If the file cannot be read (e.g., file not found, permission issues).
 */
async function readTextFileContent(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        // Preserve original error context by including it as a 'cause'
        throw new Error(`Failed to read file content from ${filePath}`, { cause: error });
    }
}

/**
 * The primary function to integrate file data for AI analysis.
 * Currently, it reads the content of a text file and returns it directly.
 * Future enhancements could include:
 * - File type detection and specific parsing logic (e.g., CSV, JSON).
 * - Chunking large files into smaller processable units.
 * - Basic text cleaning/preparation before returning.
 * @param {string} filePath - The path to the file to be integrated.
 * @returns {Promise<string>} A promise that resolves with the prepared text content for AI.
 * @throws {Error} If the file integration fails.
 */
async function integrateFileForAI(filePath) {
    // Removed redundant 'await' as readTextFileContent already returns a Promise
    return readTextFileContent(filePath);
}

module.exports = {
    integrateFileForAI,
};