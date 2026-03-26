import { DataService } from './src/renderer/src/shared/api/data.service'

async function test() {
    try {
        console.log('Fetching RistoAnime...')
        const html = await DataService.cfFetchHtml('https://ristoanime.co/series/')
        console.log('HTML Length:', html.length)
        console.log('HTML Snippet:', html.substring(0, 500))
        if (html.includes('Cloudflare')) {
            console.log('BLOCKED BY CLOUDFLARE')
        }
        if (html.includes('class="items"')) {
            console.log('FOUND class="items"')
        } else {
            console.log('NOT FOUND class="items"')
        }
    } catch (e) {
        console.error('Error:', e)
    }
}

// Since I can't run this directly easily because of path imports,
// I'll just change the code in RistoAnimeSource to use cfFetchHtml and see if it works.
