// Superliga.ro scraper for Romanian football news
// Fetches articles from superliga.ro homepage (__NEXT_DATA__ SSR props)
// and individual article pages for prediction context.

import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'

const BASE_URL = 'https://www.superliga.ro'

export interface SuperligaArticle {
  title: string
  description: string
  url: string
  publishedAt: string
  source: { name: string; url: string }
  image?: string
  category?: string
}

// ---------------------------------------------------------------------------
// Fetch and parse homepage for latest articles
// ---------------------------------------------------------------------------

export async function fetchSuperligaNews(
  options: { max?: number } = {}
): Promise<SuperligaArticle[]> {
  const cacheKey = `superliga:news:${options.max || 10}`

  return getCached(
    cacheKey,
    async () => {
      const articles: SuperligaArticle[] = []

      try {
        const res = await fetch(BASE_URL, {
          headers: {
            'User-Agent': 'PredictKick/1.0 (news aggregator)',
            'Accept': 'text/html',
          },
          next: { revalidate: 0 },
        })

        if (!res.ok) {
          console.error(`Superliga.ro fetch failed: ${res.status}`)
          return []
        }

        const html = await res.text()

        // Extract __NEXT_DATA__ JSON from the page
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
        if (nextDataMatch) {
          const nextData = JSON.parse(nextDataMatch[1])
          const props = nextData?.props?.pageProps

          // Extract articles from the page props
          // The homepage typically has articles in various props keys
          const articleSources = [
            props?.articles,
            props?.news,
            props?.latestArticles,
            props?.stiri,
            props?.featuredArticles,
          ].filter(Boolean)

          for (const source of articleSources) {
            if (Array.isArray(source)) {
              for (const item of source) {
                const article = parseArticleFromProps(item)
                if (article) articles.push(article)
              }
            }
          }
        }

        // Also extract article links from the HTML if __NEXT_DATA__ didn't yield results
        if (articles.length === 0) {
          const articleLinks = extractArticleLinksFromHTML(html)
          articles.push(...articleLinks)
        }
      } catch (err) {
        console.error('Superliga.ro scrape error:', err)
      }

      return articles.slice(0, options.max || 10)
    },
    CACHE_TTL.NEWS
  )
}

// ---------------------------------------------------------------------------
// Fetch a single article's content
// ---------------------------------------------------------------------------

export async function fetchSuperligaArticle(
  articlePath: string
): Promise<SuperligaArticle | null> {
  const url = articlePath.startsWith('http') ? articlePath : `${BASE_URL}${articlePath}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PredictKick/1.0 (news aggregator)',
        'Accept': 'text/html',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) return null

    const html = await res.text()

    // Try __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1])
      const props = nextData?.props?.pageProps

      // Article data may be in props.article, props.story, etc.
      const articleData = props?.article || props?.story || props?.data || props
      if (articleData?.title || articleData?.name) {
        return {
          title: String(articleData.title || articleData.name || ''),
          description: String(
            articleData.description || articleData.summary || articleData.excerpt ||
            articleData.content?.substring(0, 300) || ''
          ),
          url,
          publishedAt: String(articleData.publishedAt || articleData.createdAt || articleData.date || new Date().toISOString()),
          source: { name: 'Superliga.ro', url: BASE_URL },
          image: articleData.image || articleData.featuredImage || articleData.thumbnail || undefined,
          category: articleData.category || articleData.tag || undefined,
        }
      }
    }

    // Fallback: extract from meta tags
    return extractArticleFromMeta(html, url)
  } catch (err) {
    console.error(`Superliga article fetch error for ${url}:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Search superliga.ro news relevant to a specific team
// ---------------------------------------------------------------------------

export async function searchSuperligaTeamNews(
  teamName: string,
  options: { max?: number } = {}
): Promise<SuperligaArticle[]> {
  const cacheKey = `superliga:team:${teamName}:${options.max || 5}`

  return getCached(
    cacheKey,
    async () => {
      const allArticles = await fetchSuperligaNews({ max: 30 })

      // Filter articles mentioning the team name
      const teamLower = teamName.toLowerCase()
      // Map common international names to Romanian names
      const aliases = getTeamAliases(teamName)

      const matched = allArticles.filter((article) => {
        const text = `${article.title} ${article.description}`.toLowerCase()
        return aliases.some((alias) => text.includes(alias.toLowerCase()))
      })

      return matched.slice(0, options.max || 5)
    },
    CACHE_TTL.NEWS
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArticleFromProps(item: Record<string, unknown>): SuperligaArticle | null {
  if (!item) return null

  const title = String(item.title || item.name || item.headline || '')
  if (!title) return null

  const slug = String(item.slug || item.id || item.url || '')
  const url = slug.startsWith('http') ? slug : `${BASE_URL}/articole/${slug}`

  return {
    title,
    description: String(
      item.description || item.summary || item.excerpt || item.subtitle || ''
    ),
    url,
    publishedAt: String(
      item.publishedAt || item.createdAt || item.date || item.updatedAt || new Date().toISOString()
    ),
    source: { name: 'Superliga.ro', url: BASE_URL },
    image: item.image ? String(item.image) : item.featuredImage ? String(item.featuredImage) : undefined,
    category: item.category ? String(item.category) : item.tag ? String(item.tag) : undefined,
  }
}

function extractArticleLinksFromHTML(html: string): SuperligaArticle[] {
  const articles: SuperligaArticle[] = []
  // Match article links: /articole/[slug]
  const linkPattern = /href="(\/articole\/[^"]+)"/g
  const titlePattern = /<a[^>]*href="(\/articole\/[^"]+)"[^>]*>([^<]+)<\/a>/g

  let match
  const seen = new Set<string>()

  // Try to get links with surrounding text
  while ((match = titlePattern.exec(html)) !== null) {
    const path = match[1]
    const title = match[2].trim()
    if (!seen.has(path) && title.length > 10) {
      seen.add(path)
      articles.push({
        title,
        description: '',
        url: `${BASE_URL}${path}`,
        publishedAt: new Date().toISOString(),
        source: { name: 'Superliga.ro', url: BASE_URL },
      })
    }
  }

  // Also get plain links without text
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1]
    if (!seen.has(path)) {
      seen.add(path)
      // Extract title from slug
      const slug = path.split('/').pop() || ''
      const titleFromSlug = slug
        .replace(/-[a-f0-9]{8}$/, '') // remove ID suffix
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      articles.push({
        title: titleFromSlug,
        description: '',
        url: `${BASE_URL}${path}`,
        publishedAt: new Date().toISOString(),
        source: { name: 'Superliga.ro', url: BASE_URL },
      })
    }
  }

  return articles
}

function extractArticleFromMeta(html: string, url: string): SuperligaArticle | null {
  const getMetaContent = (name: string): string => {
    const match = html.match(new RegExp(`<meta[^>]*(?:property|name)="${name}"[^>]*content="([^"]*)"`, 'i'))
    return match ? match[1] : ''
  }

  const title = getMetaContent('og:title') || getMetaContent('twitter:title')
  if (!title) return null

  return {
    title,
    description: getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description'),
    url,
    publishedAt: getMetaContent('article:published_time') || new Date().toISOString(),
    source: { name: 'Superliga.ro', url: BASE_URL },
    image: getMetaContent('og:image') || undefined,
  }
}

// Map team names to Romanian equivalents for matching
function getTeamAliases(teamName: string): string[] {
  const aliases: Record<string, string[]> = {
    // Romanian Superliga teams
    'FCSB': ['FCSB', 'Steaua'],
    'CFR Cluj': ['CFR Cluj', 'CFR'],
    'Universitatea Craiova': ['Universitatea Craiova', 'U Craiova', 'Craiova'],
    'Rapid Bucuresti': ['Rapid', 'Rapid București'],
    'Dinamo Bucuresti': ['Dinamo', 'Dinamo București'],
    'Sepsi OSK': ['Sepsi', 'Sepsi OSK'],
    'FC Voluntari': ['Voluntari', 'FC Voluntari'],
    'FC Hermannstadt': ['Hermannstadt', 'Sibiu'],
    'UTA Arad': ['UTA', 'UTA Arad'],
    'Petrolul Ploiesti': ['Petrolul', 'Petrolul Ploiești'],
    'FC Botosani': ['Botoșani', 'Botosani'],
    'Farul Constanta': ['Farul', 'Farul Constanța'],
    'Otelul Galati': ['Oțelul', 'Otelul', 'Oțelul Galați'],
    'FC Arges': ['FC Argeș', 'Argeș', 'Arges'],
    'Unirea Slobozia': ['Slobozia', 'Unirea Slobozia'],
    'Csikszereda': ['Csikszereda', 'Ciuc'],
    'Metaloglobus': ['Metaloglobus'],
    'Gloria Buzau': ['Gloria Buzău', 'Buzău', 'Buzau'],
    'Corvinul Hunedoara': ['Corvinul', 'Hunedoara'],
    'Poli Iasi': ['Poli Iași', 'Poli Iasi', 'Iași'],
  }

  // Check if the team name matches any alias group
  const lower = teamName.toLowerCase()
  for (const [, aliasList] of Object.entries(aliases)) {
    if (aliasList.some((a) => a.toLowerCase() === lower || lower.includes(a.toLowerCase()))) {
      return aliasList
    }
  }

  // Default: return the team name itself
  return [teamName]
}
