// media.js
const fs = require('fs').promises;

class Media {
    static async CheckMediaAvailability(event, options) {
        const { basePath, cdn, videoFormats, audioFormats, videoPaths, audioPaths } = options;

        try {
            const allVideoPaths = [];
            const allAudioPaths = [];

            for (const vf of videoFormats) {
                for (const vPath of videoPaths) {
                    allVideoPaths.push(`${basePath}${vPath}${cdn}.${vf}`);
                }
            }

            for (const af of audioFormats) {
                for (const aPath of audioPaths) {
                    allAudioPaths.push(`${basePath}${aPath}${cdn}.${af}`);
                }
            }

            const isRemoteUrl = basePath.startsWith('http://') || basePath.startsWith('https://');

            const validVideoPaths = await Media.checkPathsExistence(allVideoPaths, isRemoteUrl);

            if (validVideoPaths.length === 0) {
                return {
                    success: false,
                    error: `No valid video found for ${cdn}`
                };
            }

            const validAudioPaths = await Media.checkPathsExistence(allAudioPaths, isRemoteUrl);

            const formats = [];
            for (const videoUrl of validVideoPaths) {
                if (validAudioPaths.length > 0) {
                    for (const audioUrl of validAudioPaths) {
                        formats.push({
                            videoUrl,
                            audioUrl
                        });
                    }
                } else {
                    formats.push({
                        videoUrl
                    });
                }
            }

            return {
                success: true,
                formats
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    static async checkPathsExistence(paths, isRemote) {
        const results = [];

        const checks = paths.map(async (p) => {
            try {
                if (isRemote) {
                    const response = await fetch(p, { method: 'HEAD', cache: 'no-cache' });
                    if (response.ok) {
                        results.push(p);
                    }
                } else {
                    await fs.access(p);
                    results.push(p);
                }
            } catch (err) {
                // do nothing
            }
        });

        await Promise.all(checks);
        return results;
    }
}

module.exports = Media