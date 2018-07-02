const path = require('path')

module.exports = {
    getPath(filePath) {
        return path.isAbsolute(filePath)
            ? filePath
            : path.normalize(path.join(process.cwd(), filePath))
    }
}