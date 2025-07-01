const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util'); // For util.isDeepStrictEqual
const readline = require('readline'); // Added for stream-based text file comparison

class AIFileReconciliationService {
    constructor(config = {}) {
        this.logPath = config.logPath || path.join(process.cwd(), 'logs', 'reconciliation.log');
        this.checksumAlgorithm = config.checksumAlgorithm || 'sha256';
        // Removed 'strictJsonComparison' as per critical review feedback,
        // as util.isDeepStrictEqual provides the robust comparison needed.
        this.verbose = config.verbose !== undefined ? config.verbose : false;
    }

    /**
     * Reconciles two files, comparing their content based on file type.
     * Supports text, CSV, and JSON file comparisons.
     *
     * @param {string} file1Path - The path to the first file.
     * @param {string} file2Path - The path to the second file (reference or comparison file).
     * @returns {Promise<object>} An object containing reconciliation status and details.
     */
    async reconcileFiles(file1Path, file2Path) {
        try {
            this._log(`Starting reconciliation for '${file1Path}' vs '${file2Path}'`);

            // Check if both files exist and are accessible
            await Promise.all([fs.access(file1Path), fs.access(file2Path)]);

            const file1Ext = path.extname(file1Path).toLowerCase();
            const file2Ext = path.extname(file2Path).toLowerCase();

            if (file1Ext !== file2Ext) {
                const message = `File extensions do not match: '${file1Ext}' vs '${file2Ext}'. Cannot perform content comparison.`;
                this._log(message, 'warn');
                return { status: 'MISMATCH_EXTENSIONS', message };
            }

            const checksum1 = await this._generateChecksum(file1Path);
            const checksum2 = await this._generateChecksum(file2Path);

            if (checksum1 === checksum2) {
                const message = `Checksums match for '${file1Path}' and '${file2Path}'. Files are identical.`;
                this._log(message, 'info');
                return { status: 'MATCH', message, checksum1, checksum2 };
            }

            this._log(`Checksums differ. Performing content comparison... (Checksum1: ${checksum1}, Checksum2: ${checksum2})`, 'info');

            let comparisonResult;
            switch (file1Ext) {
                case '.txt':
                case '.csv': // CSV files are typically text-based and can be compared line by line
                    comparisonResult = await this._compareTextFiles(file1Path, file2Path);
                    break;
                case '.json':
                    comparisonResult = await this._compareJsonFiles(file1Path, file2Path);
                    break;
                default:
                    const message = `Unsupported file type for content comparison: '${file1Ext}'. Only checksums were compared.`;
                    this._log(message, 'warn');
                    return { status: 'UNSUPPORTED_TYPE', message, checksum1, checksum2 };
            }

            if (comparisonResult.isMatch) {
                const message = `Content matches for '${file1Path}' and '${file2Path}'.`;
                this._log(message, 'info');
                return { status: 'MATCH', message, checksum1, checksum2, details: comparisonResult.details };
            } else {
                const message = `Content mismatch detected between '${file1Path}' and '${file2Path}'.`;
                this._log(message, 'error');
                return { status: 'MISMATCH_CONTENT', message, checksum1, checksum2, details: comparisonResult.details };
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                const message = `One or both files not found: ${error.path}.`;
                this._log(message, 'error');
                return { status: 'FILE_NOT_FOUND', message: message, error: error.message };
            }
            this._log(`Error during file reconciliation: ${error.message}`, 'error');
            return { status: 'ERROR', message: `An unexpected error occurred: ${error.message}`, error: error.message };
        }
    }

    /**
     * Generates a checksum for a given file.
     * @param {string} filePath - The path to the file.
     * @returns {Promise<string>} The generated checksum.
     */
    async _generateChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(this.checksumAlgorithm);
            const stream = fs.createReadStream(filePath);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', err => reject(err));
        });
    }

    /**
     * Compares the content of two text-based files line by line using streams.
     * This approach avoids loading entire files into memory, improving performance
     * and reducing memory footprint for large files.
     * @param {string} file1Path - Path to the first text file.
     * @param {string} file2Path - Path to the second text file.
     * @returns {Promise<object>} { isMatch: boolean, details: array }
     */
    async _compareTextFiles(file1Path, file2Path) {
        let isMatch = true;
        const details = [];
        let lineNum = 0;

        // Create readline interfaces for line-by-line reading
        const rl1 = readline.createInterface({
            input: fs.createReadStream(file1Path, 'utf8'),
            crlfDelay: Infinity // Treat \r\n as a single newline
        });
        const rl2 = readline.createInterface({
            input: fs.createReadStream(file2Path, 'utf8'),
            crlfDelay: Infinity
        });

        // Use async iterators for readline interfaces to compare lines concurrently
        const iter1 = rl1[Symbol.asyncIterator]();
        const iter2 = rl2[Symbol.asyncIterator]();

        try {
            let res1 = await iter1.next(); // Get first line from file 1
            let res2 = await iter2.next(); // Get first line from file 2

            while (!res1.done || !res2.done) {
                lineNum++;

                if (res1.done !== res2.done) {
                    // One file ended before the other (line count mismatch)
                    isMatch = false;
                    const endedFileBasename = res1.done ? path.basename(file1Path) : path.basename(file2Path);
                    details.push(`Line count mismatch starting at line ${lineNum}: File '${endedFileBasename}' ended prematurely.`);

                    // If verbose, log remaining lines from the longer file
                    if (this.verbose) {
                        const longerIterator = res1.done ? iter2 : iter1;
                        const longerFileNum = res1.done ? 2 : 1;
                        const longerFileBasename = res1.done ? path.basename(file2Path) : path.basename(file1Path);

                        let currentRes = res1.done ? res2 : res1; // Start from the current line of the longer file
                        while (!currentRes.done) {
                            details.push(`Line ${lineNum}: Only in File ${longerFileNum} ('${longerFileBasename}'): "${currentRes.value}"`);
                            currentRes = await longerIterator.next();
                            lineNum++; // Increment lineNum for remaining lines in the longer file
                        }
                    }
                    // Break early if not in verbose mode to prevent excessive details for large mismatches
                    if (!this.verbose) break;

                } else if (res1.value !== res2.value) {
                    // Lines exist in both files but differ in content
                    isMatch = false;
                    details.push(`Line ${lineNum} differs: File 1: "${res1.value}" | File 2: "${res2.value}"`);
                    // Limit the number of detailed mismatch lines if not in verbose mode
                    if (!this.verbose && details.length >= 5) {
                        details.push("Further differences truncated (verbose logging not enabled).");
                        break;
                    }
                }

                // Move to the next lines from both files
                res1 = await iter1.next();
                res2 = await iter2.next();
            }

        } catch (error) {
            // Log any errors encountered during file reading or processing
            this._log(`Error during text file comparison: ${error.message}`, 'error');
            return { isMatch: false, details: [`Error reading files for comparison: ${error.message}`] };
        } finally {
            // Ensure readline interfaces and their underlying streams are closed
            rl1.close();
            rl2.close();
        }

        return { isMatch, details };
    }

    /**
     * Compares the content of two JSON files using Node.js's util.isDeepStrictEqual.
     * This method performs a robust deep equality check, ignoring the order of keys
     * in objects but strictly comparing values and array order.
     * Note: This method reads the entire JSON file into memory for parsing. For
     * extremely large JSON files (e.g., hundreds of MBs or GBs), this could lead to
     * high memory consumption. A truly stream-based deep comparison without loading
     * the full object requires a custom JSON token-by-token comparison logic,
     * which is more complex and beyond the scope of using `util.isDeepStrictEqual`.
     * @param {string} file1Path - Path to the first JSON file.
     * @param {string} file2Path - Path to the second JSON file.
     * @returns {Promise<object>} { isMatch: boolean, details: array }
     */
    async _compareJsonFiles(file1Path, file2Path) {
        try {
            // Read both JSON files into memory
            const [content1, content2] = await Promise.all([
                fs.readFile(file1Path, 'utf8'),
                fs.readFile(file2Path, 'utf8')
            ]);

            // Parse JSON content into JavaScript objects
            const obj1 = JSON.parse(content1);
            const obj2 = JSON.parse(content2);

            let isMatch;
            let details = [];

            // Perform a deep strict comparison. This is the recommended approach for JSON.
            isMatch = util.isDeepStrictEqual(obj1, obj2);
            if (!isMatch) {
                details.push("JSON content differs (deep strict comparison, order of keys in objects does not matter).");
                // More detailed JSON diffing would require an external library or custom logic.
                // For verbose mode, one might log truncated stringified versions for initial inspection.
                if (this.verbose) {
                    // Example: Log stringified JSON (careful with very large objects)
                    // details.push(`File 1 (truncated): ${JSON.stringify(obj1, null, 2).substring(0, 500)}...`);
                    // details.push(`File 2 (truncated): ${JSON.stringify(obj2, null, 2).substring(0, 500)}...`);
                }
            }
            return { isMatch, details };

        } catch (parseError) {
            // Handle errors during JSON parsing (e.g., malformed JSON)
            this._log(`Error parsing JSON files: ${parseError.message}`, 'error');
            return { isMatch: false, details: [`Error parsing JSON: ${parseError.message}`] };
        }
    }

    /**
     * Internal logging method to append messages to a log file.
     * @param {string} message - The message to log.
     * @param {'info'|'warn'|'error'} [level='info'] - The log level.
     */
    async _log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

        try {
            // Ensure the log directory exists
            await fs.mkdir(path.dirname(this.logPath), { recursive: true });
            // Append the log entry to the file
            await fs.appendFile(this.logPath, logEntry, 'utf8');
        } catch (err) {
            // If logging to file fails, fall back to console error
            console.error(`Failed to write to reconciliation log file: ${err.message}`);
            console.error(logEntry); // Also log the entry to console so it's not lost
        }
    }
}

module.exports = AIFileReconciliationService;