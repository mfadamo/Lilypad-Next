const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const tempDir = path.normalize(path.join(os.tmpdir(), 'lilypad-temp')).replace(/\\/g, '/');
const createdTempFiles = new Set();

async function ensureTempDir() {
    try {
        await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create temporary directory:', error);
        throw error;
    }
}

async function writeTempFile(prefix, buffer, extension) {
    await ensureTempDir();
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.rgba`;
    const filePath = path.join(tempDir, fileName);
    try {
        await fs.writeFile(filePath, buffer);
        createdTempFiles.add(filePath);
        const urlFileName = fileName.replace(/\\/g, '/');
        return `lilypadtemp://temp-pictos/${urlFileName}`;
    } catch (error) {
        console.error(`Failed to write temporary file ${filePath}:`, error);
        throw error;
    }
}

async function cleanupTempFiles() {
    console.log('Cleaning up temporary files...');
    for (const filePath of createdTempFiles) {
        try {
            await fs.unlink(filePath);
            createdTempFiles.delete(filePath);
        } catch (error) {
            console.warn(`Failed to delete temporary file ${filePath}:`, error);
        }
    }
    try {
        await fs.rmdir(tempDir);
        console.log(`Temporary directory ${tempDir} removed.`);
    } catch (error) {
        if (error.code === 'ENOTEMPTY') {
            console.warn(`Temporary directory ${tempDir} not empty, skipping removal.`);
        } else {
            console.warn(`Failed to remove temporary directory ${tempDir}:`, error);
        }
    }
    console.log('Temporary file cleanup complete.');
}

module.exports = {
    writeTempFile,
    cleanupTempFiles,
    tempDir
};
