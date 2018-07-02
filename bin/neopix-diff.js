#!/usr/bin/env node

const path = require('path');
const fs = require('mz/fs');
const fse = require('fs-extra');
const program = require('commander');

const compareImages = require('resemblejs/compareImages');
const { getPath } = require('../lib/localPath');

// @TODO: Make all this as arguments.
const FOLDERS = {
    original: getPath('example/xxx'),
    updated: getPath('example/yyy'),
    diff: getPath('example/diff')
};

program
    .version(require('../package.json').version)
    .option('-i --input <path>', 'Original image path. Required')
    .parse(process.argv);

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
            largeImageThreshold: 1200,
            useCrossOrigin: false,
            outputDiff: true
        },
        scaleToSameSize: true,
        ignore: 'antialiasing'
    };

    const data = await compareImages(
        await fs.readFile(path.join(FOLDERS.original, fileName)),
        await fs.readFile(path.join(FOLDERS.updated, fileName)),
        options
    );

    await fs.writeFile(path.join(FOLDERS.diff, fileName), data.getBuffer());

    // @TODO: Make this an argument
    if (data.rawMisMatchPercentage > 1) {
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

        if ( !fs.existsSync(path.join(FOLDERS.updated, imageName)) ) {
            await fse.move(path.join(FOLDERS.original, imageName), path.join(FOLDERS.updated, imageName));
        } else {
            await fse.move(image, path.join(FOLDERS.updated, imageName), {overwrite: true});
        }
    } catch (e) {
        console.error(e);
    }
}


/**
 * Simple check if the input argument exists.
 */
if (program.input) {
    const filePath = getPath(program.input);
    const fileName = path.basename(filePath);

    async function init() {
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