const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const convertVideoToMP4 = (inputFilePath, outputFilePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
            .toFormat('mp4')
            .on('end', () => {
                console.log('Conversion finished');
                resolve(outputFilePath);
            })
            .on('error', (err) => {
                console.error('Conversion error:', err);
                reject(err);
            })
            .save(outputFilePath);
    });
};

module.exports = { convertVideoToMP4 };
