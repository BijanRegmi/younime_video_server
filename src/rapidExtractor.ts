import { createDecipheriv } from "crypto"
import { emptyAnimResource } from "./extractor2"
import CryptoJS from "crypto-js"

const EVP_BytesToKey = require("evp_bytestokey")
const m3u8 = require("m3u8-parser")

export class RapidExtractor {
    embedUrl: URL | undefined
    keys: number[][][] = []

    serverUrls = ["https://megacloud.tv", "https://rapid-cloud.co"]
    sourcesUrls = [
        "/embed-2/ajax/e-1/getSources?id=",
        "/ajax/embed-6-v2/getSources?id=",
    ]

    async init(url?: string) {
        this.keys = await this._getdecryptKey()
        if (url) this.embedUrl = new URL(url)
        return this
    }

    loadUrl(url: string) {
        this.embedUrl = new URL(url)
        return this
    }

    async extract(): Promise<AnimeResource> {
        const type = this.embedUrl?.hostname.includes("megacloud") ? 0 : 1
        if (!this.keys[type] || !this.embedUrl) return emptyAnimResource

        const id = this.embedUrl.pathname.split("/").pop()
        const resourceUrl = `${this.serverUrls[type]}${this.sourcesUrls[type]}${id}`
        console.log(`==> Fetching resources from: ${resourceUrl}`)
        const resource = await fetch(resourceUrl)
            .then(res => res.json() as ServerSourceResponse)
            .catch(console.error)

        if (!resource) return emptyAnimResource

        let decryptedSources: DecryptedSource[]

        if (
            (resource.encrypted || typeof resource.sources == "string") &&
            resource.sources
        ) {
            decryptedSources = JSON.parse(
                await this.decipher(resource.sources as string)
            )
        } else if (!resource.sources) {
            decryptedSources = []
        } else {
            decryptedSources = resource.sources as DecryptedSource[]
        }

        const retval: AnimeResource = {
            source:
                decryptedSources == undefined
                    ? []
                    : await Promise.all(decryptedSources.map(this.m3u8ToVideo)),
            tracks:
                decryptedSources == undefined
                    ? []
                    : resource.tracks?.map(t => ({
                          src: t.file,
                          kind: t.kind || "captions",
                          srcLang: t.label,
                          label: t.label,
                          default: t.default,
                      })) || [],
            intro: {
                start: resource.intro?.start || -1,
                end: resource.intro?.end || -1,
            },
            outro: {
                start: resource.outro?.start || -1,
                end: resource.intro?.end || -1,
            },
        }
        console.log("=> Fetched resources", retval)
        return retval
    }

    async m3u8ToVideo(source: DecryptedSource) {
        const parser = new m3u8.Parser()
        const manifest = await fetch(source.file).then(r => r.text())
        parser.push(manifest)

        const host = source.file.slice(0, source.file.lastIndexOf("/"))

        const response: VideoSource = {
            name: source.name,
            type: source.type,
            qualities: parser.manifest.playlists
                .sort((a: M3U8Playlist, b: M3U8Playlist) =>
                    a.attributes.RESOLUTION.height <
                    b.attributes.RESOLUTION.height
                        ? -1
                        : 1
                )
                .map((p: M3U8Playlist) => ({
                    url: `${host}/${p.uri}`,
                    name: `${p.attributes.RESOLUTION.height}p`,
                })),
        }

        return response
    }

    async decipher(input: string) {
        for (let key of this.keys) {
            try {
                const inputArray = input.split("")
                let extractedKey = ""

                for (const index of key) {
                    for (let i = index[0]; i < index[1]; i++) {
                        extractedKey += inputArray[i]
                        inputArray[i] = ""
                    }
                }

                const sources = inputArray.join("")

                return CryptoJS.AES.decrypt(sources, extractedKey).toString(
                    CryptoJS.enc.Utf8
                )
            } catch (err) {
                console.error("==> Deciphering failed with", key)
                continue
            }
        }
        console.error(
            "==> Failed to decipher with all keys. Returing empty resource."
        )
        return "[]"
    }

    async _getdecryptKey() {
        return [
            await fetch(process.env.KEY_URL_6 as string)
                .then(res => res.json())
                .catch(err => {
                    console.error(err)
                    return ""
                }),
            await fetch(process.env.KEY_URL_4 as string)
                .then(res => res.json())
                .catch(err => {
                    console.error(err)
                    return ""
                }),
            await fetch(process.env.KEY_URL_0 as string)
                .then(res => res.json())
                .catch(err => {
                    console.error(err)
                    return ""
                }),
        ]
    }
}
