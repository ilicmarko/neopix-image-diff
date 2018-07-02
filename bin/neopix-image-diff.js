#!/usr/bin/env node

const path = require('path');
const fs = require('mz/fs');
const fse = require('fs-extra');
const program = require('commander');

const compareImages = require('resemblejs/compareImages');
const { getPath } = require('../lib/localPath');

// @TODO: Make all this as arguments.

let mode;
let FOLDERS;
program
    .version(require('../package.json').version)
    .option('-i --input <path>', 'Original image path. Required')
    .option('-t --threshold <float>', 'Threshold until the test fails', parseFloat)
    .option('-m --mode <mode>', 'What would you like to ignore?', /^(nothing|less|antialiasing|colors|alpha)$/i)
    .option('-d --dir <dir>', 'Base directory where you would like to create test folders.')
    .parse(process.argv);

async function setup() {
    mode = program.mode;
    if (mode === true) {
        console.log(`Invalid mode`);
        console.log('Falling back to default mode: nothing');

        mode = 'nothing';
    }
    const dir = (program.dir) ? program.dir : './';

    FOLDERS = {
        original: getPath(path.join(dir, '/xxx')),
        updated: getPath(path.join(dir, '/yyy')),
        diff: getPath(path.join(dir, '/diff'))
    };
}


function requiredArgs() {
    return program.input && program.threshold;
}

/**
 * Calculate diff
 * @param {String} fileName
 * @returns {Promise<*>}
 */
async function getDiff(fileName) {
    const options = {
        output: {
            errorColor: {
                red: 255,
                green: 0,
                blue: 255
            },
            errorType: "movement",
            transparency: 0.3,
            largeImageThreshold: 1920,
            useCrossOrigin: false,
            outputDiff: true,
        },
        scaleToSameSize: true,
        ignore: mode
    };

    const data = await compareImages(
        await fs.readFile(path.join(FOLDERS.original, fileName)),
        await fs.readFile(path.join(FOLDERS.updated, fileName)),
        options
    );

    await fs.writeFile(path.join(FOLDERS.diff, fileName), data.getBuffer());

    if (data.rawMisMatchPercentage > program.threshold) {
        return process.exit(1);
    } else {
        return process.exit(0);
    }
}

/**
 * Ensure that all required folders exists, if not make them.
 *
 * @returns {Promise<void>}
 */
async function checkFolders() {
    try {
        await fse.ensureDir(FOLDERS.original);
        await fse.ensureDir(FOLDERS.updated);
        await fse.ensureDir(FOLDERS.diff);
    } catch (e) {
        console.error(e);
    }
}

/**
 * Initial state:
 *      Copy the `image` to `original` folder.
 *      Move the `image` to the `updates` folder.
 * Rerun:
 *      Check if this image already exists in the `original` folder, if it doesn't **copy it**.
 *      Move the `image` to the `updates` folder.
 *      Run the diff.
 *
 * @param {String} image Image path that needs to be compared
 * @param {String} imageName Image name + extension
 * @returns {Promise<void>}
 */
async function copyImage(image, imageName) {
    let moved = false;
    try {
        if ( !fs.existsSync(path.join(FOLDERS.original, imageName)) ) {
            await fse.copy(image, path.join(FOLDERS.original, imageName));
        }

        // @TODO: Should I move or copy?
        if ( !fs.existsSync(path.join(FOLDERS.updated, imageName)) ) {
            await fse.copy(path.join(FOLDERS.original, imageName), path.join(FOLDERS.updated, imageName));
        } else {
            await fse.copy(image, path.join(FOLDERS.updated, imageName), {overwrite: true});
        }
    } catch (e) {
        console.error(e);
    }
}


/**
 * Simple check if the input argument exists.
 */
if (requiredArgs()) {
    const filePath = getPath(program.input);
    const fileName = path.basename(filePath);

    async function init() {
        await setup();
        await checkFolders();
        await copyImage(filePath, fileName);
        await getDiff(fileName);
    }

    init()
        .catch(e => {
            console.error(e);
        });
} else {
    program.help();
}