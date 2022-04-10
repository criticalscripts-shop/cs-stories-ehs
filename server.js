process.env.NODE_ENV = 'production'

const origWarning = process.emitWarning

process.emitWarning = (...args) => { // A dirty hack to suppress busboy deprecation warning regarding Buffer since we cannot really overcome it.
    if (args[2] !== 'DEP0005')
        return origWarning.apply(process, args)
}

const config = require('./config.js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
const fileUpload = require('express-fileupload')
const bodyParser = require('body-parser')
const app = express()
const storagePath = path.join(__dirname, 'storage')
const metaPath = path.join(storagePath, 'meta')
const thumbnailsPath = path.join(storagePath, 'thumbnails')
const videosPath = path.join(storagePath, 'videos')

if ((!fs.existsSync(storagePath)) || (!fs.existsSync(metaPath)) || (!fs.existsSync(thumbnailsPath)) || (!fs.existsSync(videosPath)))
    throw new Error('[criticalscripts.shop] The storage directory is either missing or invalid.')

if ((!config) || (!config.authKey))
    throw new Error('[criticalscripts.shop] The configuration file is either incomplete or invalid.')

let storedStoriesCount = 0
let dirFile = null

const accessKeys = []
const storageDir = fs.opendirSync(metaPath)

while ((dirFile = storageDir.readSync()) !== null)
    if (dirFile.isFile() && dirFile.name.endsWith('.json'))
        storedStoriesCount++

storageDir.closeSync()

app.use(fileUpload({
    limits: {
        fileSize: config.maxSize * 1024 * 1024,
        files: 2
    },

    safeFileNames: true
}))

app.use(bodyParser.json())

app.get('/', (req, res) => res.redirect(301, 'https://criticalscripts.shop'))

app.post('/internal', (req, res) => {
    if (req.header('X-Auth-Key') !== config.authKey) {
        res.status(401).send()
        return
    }

    const data = req.body.data

    switch (req.body.type) {
        case 'add':
            if (accessKeys.includes(data.old))
                accessKeys.splice(accessKeys.indexOf(data.old), 1)
        
            if (!accessKeys.includes(data.key))
                accessKeys.push(data.key)

            break

        case 'remove':
            if (accessKeys.includes(data))
                accessKeys.splice(accessKeys.indexOf(data), 1)

            break

        case 'delete':
            const thumbnailPath = path.join(thumbnailsPath, `${data}.jpg`)
            const videoPath = path.join(videosPath, `${data}.webm`)
            const mPath = path.join(metaPath, `${data}.json`)
        
            if (fs.existsSync(thumbnailPath))
                fs.unlinkSync(thumbnailPath)
        
            if (fs.existsSync(videoPath))
                fs.unlinkSync(videoPath)
        
            if (fs.existsSync(mPath))
                fs.unlinkSync(mPath)

            break

        case 'reset':
            const resetStorageDir = fs.opendirSync(metaPath)

            storedStoriesCount = 0

            while ((dirFile = resetStorageDir.readSync()) !== null)
                if (dirFile.isFile() && dirFile.name.endsWith('.json')) {
                    const uuid = dirFile.name.replace('.json', '')

                    if (!data.includes(uuid)) {
                        const thumbnailPath = path.join(thumbnailsPath, `${uuid}.jpg`)
                        const videoPath = path.join(videosPath, `${uuid}.webm`)

                        if (fs.existsSync(thumbnailPath))
                            fs.unlinkSync(thumbnailPath)

                        if (fs.existsSync(videoPath))
                            fs.unlinkSync(videoPath)

                        fs.unlinkSync(path.join(metaPath, dirFile.name))
                    } else
                        storedStoriesCount++
                }

            resetStorageDir.closeSync()

            break
    }

    res.send()
})

app.get('/thumbnail/:uuid.jpg', (req, res) => {
    const thumbnailPath = path.join(thumbnailsPath, `${req.params.uuid}.jpg`)

    if (thumbnailPath.indexOf(thumbnailsPath) !== 0) {
        res.status(400).send()
        return
    } else if (!fs.existsSync(thumbnailPath)) {
        res.status(404).send()
        return
    }

    res.sendFile(thumbnailPath)
})

app.get('/video/:key/:uuid.webm', (req, res) => {
    if (!accessKeys.includes(req.params.key)) {
        res.status(401).send()
        return
    }

    if (req.method === 'HEAD') {
        const mPath = path.join(metaPath, `${req.params.uuid}.json`)

        if (mPath.indexOf(metaPath) !== 0) {
            res.status(400).send()
            return
        } else if (!fs.existsSync(mPath)) {
            res.status(404).send()
            return
        }

        res.header('X-Video-Duration', JSON.parse(fs.readFileSync(mPath)).duration).send()
    } else {
        const videoPath = path.join(videosPath, `${req.params.uuid}.webm`)

        if (videoPath.indexOf(videosPath) !== 0) {
            res.status(400).send()
            return
        } else if (!fs.existsSync(videoPath)) {
            res.status(404).send()
            return
        }

        res.sendFile(videoPath)
    }
})

app.post('/upload/:key/:duration', (req, res) => {
    if (!accessKeys.includes(req.params.key)) {
        res.status(401).send()
        return
    } else if (storedStoriesCount + 1 > config.maximumStoriesStored) {
        res.status(503).send()
        return
    }

    const uuid = crypto.randomUUID()

    let video = null
    let thumbnail = null

    for (const key in req.files.files)
        if (req.files.files[key].name === 'video')
            video = req.files.files[key]
        else if (req.files.files[key].name === 'thumbnail')
            thumbnail = req.files.files[key]

    if (video && thumbnail && (!video.truncated) && (!thumbnail.truncated)) {
        fs.writeFileSync(path.join(thumbnailsPath, `${uuid}.jpg`), thumbnail.data)
        fs.writeFileSync(path.join(videosPath, `${uuid}.webm`), video.data)

        fs.writeFileSync(path.join(metaPath, `${uuid}.json`), JSON.stringify({
            timestamp: Date.now(),
            duration: isNaN(req.params.duration) ? 0 : parseFloat(req.params.duration)
        }))

        res.json({
            uuid
        })
    } else
        res.status(413).send()
})

app.listen(config.port, config.listeningIpAddress, () => console.log(`[criticalscripts.shop] Stories Hosting Server | Listening (${config.listeningIpAddress || '0.0.0.0'}:${config.port})`))
