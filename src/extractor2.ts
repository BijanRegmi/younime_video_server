import { JSDOM } from "jsdom"
import { RapidExtractor } from "./rapidExtractor"

export const emptyAnimResource = {
    source: [],
    tracks: [],
    intro: { start: -1, end: -1 },
    outro: { start: -1, end: -1 },
}

const headers = {
    "X-Requested-With": "XMLHttpRequest",
    referer: process.env.REFERRER || "",
}

const getEmbedLinks = async (serverId: string | null) => {
    if (!serverId) return
    const epSourceUrl = `${process.env.SOURCES_URL}${serverId}`

    console.log(`==> Fetching sources: ${epSourceUrl}`)
    const embedResp = await fetch(epSourceUrl, { headers })
        .then(res => res.json() as Promise<{ link: string }>)
        .catch(console.error)

    if (!embedResp)
        throw { custom: true, message: "Failed to get sources", epSourceUrl }

    return embedResp.link
}

const getServers = async (id: number) => {
    const serverUrl = `${process.env.SERVERS_URL}${id}`

    console.log(`==> Fetching servers: ${serverUrl}`)
    const serverResp = await fetch(serverUrl, { headers })
        .then(res => res.json() as Promise<{ status: Boolean; html: string }>)
        .catch(console.error)

    if (!serverResp)
        throw { custom: true, message: "Failed to get servers", serverUrl }

    //////////////////////////////////////////////////////////////////////////////////

    const dom = new JSDOM(serverResp.html).window.document

    const subServerElements = Array.from(
        dom.querySelectorAll(".servers-sub .server-item")
    )
    const dubServerElements = Array.from(
        dom.querySelectorAll(".servers-dub .server-item")
    )

    const subServers = subServerElements.map(s => {
        return {
            id: s.getAttribute("data-id"),
            name: s.textContent?.trim(),
        }
    })
    const dubServers = dubServerElements.map(s => {
        return {
            id: s.getAttribute("data-id"),
            name: s.textContent?.trim(),
        }
    })

    return { subServers, dubServers }
}

export const VideoFromEpId = async (id: number) => {
    const { subServers, dubServers } = await getServers(id)
    console.log({ subServers, dubServers })

    const embeds = {
        subSources: await Promise.all(subServers.map(s => getEmbedLinks(s.id))),
        dubSources: await Promise.all(dubServers.map(d => getEmbedLinks(d.id))),
    }
    console.log(embeds)

    const subRapid = embeds.subSources.find(r =>
        r?.toLowerCase().includes("rapid")
    )
    const dubRapid = embeds.dubSources.find(r =>
        r?.toLowerCase().includes("rapid")
    )
    console.log({ subRapid, dubRapid })

    const extractor = await new RapidExtractor().init()

    return {
        sub: subRapid
            ? await extractor.loadUrl(subRapid).extract()
            : emptyAnimResource,
        dub: dubRapid
            ? await extractor.loadUrl(dubRapid).extract()
            : emptyAnimResource,
    }
}
